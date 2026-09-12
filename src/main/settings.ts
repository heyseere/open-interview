import { app, dialog, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { LocalAsrLanguage, LocalAsrModelSize } from './whisper-cpp'
import { listOpenAIModels } from './openai-models'
import { getSecret, setSecret, SECRET_FIELDS_LIST } from './secure-settings'
import { setMainLanguage, tMain } from './i18n'

/**
 * Load API keys persisted via safeStorage into the runtime settings object.
 * Must run after the app is ready (safeStorage requires it). Idempotent.
 */
export function loadEncryptedSecrets(): void {
  for (const field of SECRET_FIELDS_LIST) {
    const secret = getSecret(field)
    if (secret) settings[field] = secret
  }
}

ipcMain.handle('getAppSettings', () => {
  loadEncryptedSecrets()
  return settings
})

ipcMain.handle('updateAppSettings', (_event, _settings) => {
  Object.assign(settings, _settings)
  // Persist any changed secret keys encrypted via safeStorage
  for (const field of SECRET_FIELDS_LIST) {
    if (field in _settings) {
      setSecret(field, typeof _settings[field] === 'string' ? _settings[field] : '')
    }
  }
  if ('language' in _settings) {
    setMainLanguage(_settings.language)
  }
  if ('privacyMode' in _settings) {
    applyPrivacyMode()
  }
})

ipcMain.handle('list-openai-models', (_event, config: { baseURL?: unknown; apiKey?: unknown }) => {
  const baseURL = typeof config?.baseURL === 'string' ? config.baseURL : ''
  const apiKey = typeof config?.apiKey === 'string' ? config.apiKey : ''
  return listOpenAIModels(baseURL, apiKey)
})

/** Show/hide the macOS dock icon. No-op on other platforms. */
export function applyDockVisibility(hidden: boolean): void {
  if (process.platform !== 'darwin') return
  if (hidden) {
    app.dock?.hide()
  } else {
    app.dock?.show()
  }
}

/**
 * The privacy switch also owns the window posture: ON = stealth overlay
 * (always-on-top, visible on all workspaces and full screen, hidden from
 * Mission Control and the Windows taskbar); OFF = a plain normal window.
 * Called from applyPrivacyMode (startup + renderer sync) and from
 * main-window.ts on ready-to-show.
 */
export function applyWindowPosture(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return
  const stealth = settings.privacyMode
  if (stealth) {
    window.setAlwaysOnTop(true, 'screen-saver', 1)
  } else {
    // Passing a level together with `false` leaves the window at that level
    // on macOS — reset with the plain flag so it really demotes
    window.setAlwaysOnTop(false)
  }
  // Never pass skipTransformProcessType here: on macOS ≥10.14 a window can
  // only float above fullscreen spaces when its app is an accessory
  // (UIElement) app, and Electron v37 performs exactly that transform
  // internally (DockHide/DockShow) when the option is omitted. Skipping it
  // leaves the app Regular and the window vanishes behind fullscreen apps.
  window.setVisibleOnAllWorkspaces(stealth, {
    visibleOnFullScreen: stealth
  })
  window.setHiddenInMissionControl(stealth)
  if (process.platform === 'win32') {
    window.setSkipTaskbar(!stealth)
  }
}

/**
 * Apply the privacy switch end to end: window capture protection, the
 * window posture (stealth overlay vs plain normal window, see
 * applyWindowPosture) and macOS dock visibility. The Windows false→true
 * reset dance works around captures that keep showing a window whose
 * protection was re-enabled at runtime.
 */
export function applyPrivacyMode(): void {
  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (process.platform === 'win32' && settings.privacyMode) {
      mainWindow.setContentProtection(false)
    }
    mainWindow.setContentProtection(settings.privacyMode)
    applyWindowPosture(mainWindow)
  }
  applyDockVisibility(settings.privacyMode)
}

ipcMain.handle('selectScreenshotDir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: tMain('dialog.selectScreenshotDir')
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

export const settings = {
  apiBaseURL: process.env.API_BASE_URL || '',
  apiKey: process.env.API_KEY || '',
  model: process.env.MODEL || '',
  customPrompt: '',
  screenshotAutoSave: false,
  screenshotDir: '',
  localAsrModelSize: 'base' as LocalAsrModelSize,
  localAsrLanguage: 'auto' as LocalAsrLanguage,
  chunkSeconds: 5,
  /** UI language, synced from the renderer settings store */
  language: 'zh-CN' as 'zh-CN' | 'en',
  /**
   * Privacy mode (off by default, toggleable from the header shield button):
   * window invisible to screen sharing/recording, hidden macOS dock icon,
   * screenshots never written to disk or previewed.
   */
  privacyMode: false,
  audioInputDeviceId: ''
}

export type AppSettings = typeof settings
