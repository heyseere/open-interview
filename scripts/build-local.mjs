import { spawn } from 'node:child_process'

/**
 * Fast local packaging for day-to-day testing:
 *   - skips code signing (`CSC_IDENTITY_AUTO_DISCOVERY=false`) so no keychain
 *     prompts or Apple timestamp round-trips can stall the build
 *   - produces an unpacked app bundle only (`--dir`), no DMG / zip
 * Cross-platform (no shell env-var syntax), so it also works on Windows.
 *
 * Usage: npm run build:local
 * Output: dist/mac-arm64/Open Interview.app (or dist/win-unpacked on Windows)
 */
/**
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<void>}
 */
function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...env }
    })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))
    )
    child.on('error', reject)
  })
}

const noSignEnv = { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const started = Date.now()
await run(npx, ['electron-vite', 'build'], noSignEnv)
await run(npx, ['electron-builder', '--mac', '--dir'], noSignEnv)
console.log(
  `\n[build:local] done in ${((Date.now() - started) / 1000).toFixed(1)}s (unsigned, no DMG)`
)
