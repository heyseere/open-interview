import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Packaged-app smoke test.
 *
 * Launches the built app, lets it run briefly, and fails if the main process
 * dies or prints an uncaught exception / missing-module error — exactly the
 * class of bug that only appears after packaging (e.g. a dependency removed
 * from package.json still required by a bundled library).
 *
 * Usage: npm run smoke
 * Env:   SMOKE_MS (default 12000)
 */
const ROOT = process.cwd()
const RUN_MS = Number(process.env.SMOKE_MS ?? 12000)

/**
 * @returns {string | null} first packaged executable under dist/
 */
function findApp() {
  const candidates = []
  for (const dir of ['mac-arm64', 'mac', 'mac-x64', 'win-unpacked']) {
    const base = join(ROOT, 'dist', dir)
    if (!existsSync(base)) continue
    if (dir.startsWith('win')) {
      for (const entry of readdirSync(base)) {
        if (entry.endsWith('.exe')) candidates.push(join(base, entry))
      }
    } else {
      for (const entry of readdirSync(base)) {
        if (entry.endsWith('.app')) {
          const name = entry.replace(/\.app$/, '')
          candidates.push(join(base, entry, 'Contents', 'MacOS', name))
        }
      }
    }
  }
  return candidates[0] ?? null
}

const appPath = findApp()
if (!appPath) {
  console.error('[smoke] no packaged app found under dist/ — run `npm run build:local` first')
  process.exit(1)
}
if (!existsSync(appPath)) {
  console.error(`[smoke] app executable missing: ${appPath}`)
  process.exit(1)
}

// The app no longer ships the local-ASR engine (it is installed through
// Homebrew / winget on first use), so packaging must NOT carry it: a leftover
// extraResources entry would silently add ~14 MB to every installer.
const bundledEnginePath =
  process.platform === 'win32'
    ? join(dirname(appPath), 'resources', 'whisper')
    : join(dirname(appPath), '..', 'Resources', 'whisper')
if (existsSync(bundledEnginePath)) {
  console.error(
    `[smoke] packaged app still contains a bundled whisper engine: ${bundledEnginePath} — remove the extraResources entry from electron-builder.yml`
  )
  process.exit(1)
}

console.log(`[smoke] launching ${appPath}`)
// Hermetic run: point userData at a throwaway dir so the app never reads or
// mutates the real profile — and never touches the login keychain, where a
// freshly built (ad-hoc signed) binary would otherwise trip a modal keychain
// ACL prompt that blocks startup until a human answers it.
const userDataDir = mkdtempSync(join(tmpdir(), 'open-interview-smoke-'))
const child = spawn(appPath, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, OPEN_INTERVIEW_USER_DATA_DIR: userDataDir }
})
let output = ''
child.stdout.on('data', (chunk) => (output += chunk.toString()))
child.stderr.on('data', (chunk) => (output += chunk.toString()))

let exited = false
child.on('exit', (code) => {
  exited = true
  console.error(`[smoke] app exited early with code ${code}`)
  console.error(output.trim().slice(-2000))
  process.exit(1)
})

setTimeout(() => {
  if (exited) return
  child.kill()
  const fatal = /cannot find module|uncaught exception|error: cannot|failed to load/i.test(output)
  if (fatal) {
    console.error('[smoke] fatal startup error detected:')
    console.error(output.trim().slice(-2000))
    process.exit(1)
  }
  // A main-process crash during module init shows Electron's modal error
  // dialog WITHOUT writing to stdout (the process stays alive), so "no fatal
  // output" alone proves nothing. The app must have logged its window-created
  // marker — otherwise it is stuck on an invisible error dialog.
  if (!/window created/.test(output)) {
    console.error('[smoke] app never reached window creation (stuck on a startup error dialog?):')
    console.error(output.trim().slice(-2000))
    process.exit(1)
  }
  console.log(`[smoke] ok — app stayed alive for ${RUN_MS}ms with no startup errors`)
  process.exit(0)
}, RUN_MS)
