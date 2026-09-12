import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

console.log(`[smoke] launching ${appPath}`)
const child = spawn(appPath, { stdio: ['ignore', 'pipe', 'pipe'] })
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
  console.log(`[smoke] ok — app stayed alive for ${RUN_MS}ms with no startup errors`)
  process.exit(0)
}, RUN_MS)
