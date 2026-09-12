/**
 * Pure policy helper (no Electron import, so it stays unit-testable).
 *
 * Only a packaged macOS app can own a TCC decision: when Electron is launched
 * from a shell (`npm run dev`), macOS attributes the microphone /
 * screen-recording prompt to that terminal program instead of the app — the
 * app then silently gets no grant, while the terminal quietly collects one.
 * External child processes (uv, python, installers) must never be the ones to
 * trigger a permission prompt either; they only ever read files we hand them.
 */
export function canOwnTccPrompt(isPackaged: boolean, platform = process.platform): boolean {
  return platform === 'darwin' && isPackaged
}
