import { app, desktopCapturer, ipcMain, shell, systemPreferences } from 'electron'
import { canOwnTccPrompt } from './permissions-policy'

export type MediaPermissionName = 'microphone' | 'screen'

export type MediaPermissionStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unknown'

export interface MediaPermissionsResult {
  microphone: MediaPermissionStatus
  screen: MediaPermissionStatus
}

/**
 * macOS TCC gate for speech capture.
 *
 * The Chromium-level handlers in index.ts only cover the renderer-internal
 * permission layer. The OS-level (TCC) prompts must be requested by the app
 * itself — otherwise users resorted to workarounds like granting access to
 * a terminal program. This asks the OS on the app's own behalf:
 *  - microphone: `systemPreferences.askForMediaAccess` shows the TCC prompt
 *    attributed to this app (no-op unless status is 'not-determined')
 *  - screen (system audio loopback via getDisplayMedia): touching
 *    `desktopCapturer` from the main process is what makes macOS show the
 *    screen-recording prompt attributed to this app
 *
 * On Windows every status reports 'granted', so this is a no-op there.
 * In dev builds on macOS it reports 'unknown' without prompting (see
 * `canOwnTccPrompt`) so no grant is ever attributed to another program.
 */
export async function ensureMediaPermissions(): Promise<MediaPermissionsResult> {
  if (process.platform !== 'darwin') {
    return { microphone: 'granted', screen: 'granted' }
  }

  if (!canOwnTccPrompt(app.isPackaged)) {
    // Ask nothing: the OS would attribute any prompt to the terminal that
    // spawned Electron, not to this app.
    return { microphone: 'unknown', screen: 'unknown' }
  }

  let microphone = systemPreferences.getMediaAccessStatus('microphone') as MediaPermissionStatus
  if (microphone === 'not-determined') {
    microphone = (await systemPreferences.askForMediaAccess('microphone')) ? 'granted' : 'denied'
  }

  // `getMediaAccessStatus('screen')` is unreliable on macOS — Electron can
  // report 'granted' even though TCC has never decided (then capture silently
  // yields nothing and users fall back to terminal workarounds). Always touch
  // desktopCapturer instead: macOS shows the screen-recording prompt from this
  // call while the decision is pending, and it is a cheap no-op once granted.
  await desktopCapturer.getSources({ types: ['screen'] })
  const screen = systemPreferences.getMediaAccessStatus('screen') as MediaPermissionStatus

  return { microphone, screen }
}

/**
 * First-launch convenience: ask for every still-undetermined permission right
 * after startup, so TCC decisions are made inside the packaged app itself and
 * never require an external program. Dev runs are skipped on purpose — there
 * macOS attributes TCC prompts to the terminal that spawned Electron.
 */
export function promptStartupMediaPermissions(): void {
  if (process.platform !== 'darwin' || !app.isPackaged) return
  setTimeout(() => {
    void ensureMediaPermissions().catch((err) =>
      console.error('Startup media-permission prompt failed:', err)
    )
  }, 1500)
}

/**
 * Read-only status snapshot for the permissions page. Never prompts —
 * `ensureMediaPermissions` owns all actual TCC prompting.
 */
export function getMediaPermissionStatus(): MediaPermissionsResult {
  if (process.platform !== 'darwin') {
    return { microphone: 'granted', screen: 'granted' }
  }
  return {
    microphone: systemPreferences.getMediaAccessStatus('microphone') as MediaPermissionStatus,
    screen: systemPreferences.getMediaAccessStatus('screen') as MediaPermissionStatus
  }
}

/**
 * Deep-link into the matching System Settings privacy pane. Once a TCC
 * decision is 'denied' the system prompt can never reappear, so pointing the
 * user at the exact pane is the only remaining fix.
 */
export function openPrivacySettings(pane: 'microphone' | 'screen'): void {
  if (process.platform !== 'darwin') return
  const url =
    pane === 'microphone'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  void shell.openExternal(url).catch(() => undefined)
}

ipcMain.handle('ensure-media-permissions', () => ensureMediaPermissions())
ipcMain.handle('get-media-permission-status', () => getMediaPermissionStatus())
ipcMain.handle('open-privacy-settings', (_event, pane: 'microphone' | 'screen') =>
  openPrivacySettings(pane)
)

/**
 * Lets the renderer know whether it is running as a packaged app. UIs that
 * would touch a protected device (e.g. probing microphones for labels) must
 * gate on this so a TCC prompt is never attributed to another program.
 */
ipcMain.handle('get-app-info', () => ({
  isPackaged: app.isPackaged,
  platform: process.platform
}))
