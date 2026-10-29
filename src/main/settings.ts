import { app, dialog, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { LocalAsrLanguage, LocalAsrModelSize } from '../shared/asr'
import { listOpenAIModels } from './openai-models'
import {
  LEGACY_API_KEY_FIELD,
  PROVIDER_API_KEYS_FIELD,
  getSecret,
  setSecret
} from './secure-settings'
import { setMainLanguage, tMain } from './i18n'

/**
 * Load API keys persisted via safeStorage into the runtime settings object.
 * Must run after the app is ready (safeStorage requires it). Idempotent.
 */
export async function loadEncryptedSecrets(): Promise<void> {
  const providerKeys = await getProviderApiKeys()
  // One-time migration from the legacy single-key secret: the renderer's
  // first provider is called 'default', so adopt the old key for it.
  if (Object.keys(providerKeys).length === 0) {
    const legacy = await getSecret(LEGACY_API_KEY_FIELD)
    if (legacy) {
      await setProviderApiKeys({ [settings.providerId]: legacy })
      providerKeys[settings.providerId] = legacy
    }
  }
  // The renderer's sync is authoritative for which provider is active; until
  // it arrives the last known provider id is used.
  settings.providerApiKey = providerKeys[settings.providerId] ?? ''
  settings.apiKey = settings.providerApiKey
}

/** Read the decrypted id → apiKey map (empty on any failure). */
export async function getProviderApiKeys(): Promise<Record<string, string>> {
  const raw = await getSecret(PROVIDER_API_KEYS_FIELD)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value) result[id] = value
    }
    return result
  } catch {
    return {}
  }
}

/** Merge `patch` into the encrypted id → apiKey map. A no-op when the merge
 * would change nothing, so a per-keystroke settings sync cannot turn into a
 * needless encrypt + atomic-write cycle. */
export async function setProviderApiKeys(patch: Record<string, string>): Promise<void> {
  const current = await getProviderApiKeys()
  const next = { ...current }
  let changed = false
  for (const [id, value] of Object.entries(patch)) {
    if (value) {
      if (next[id] !== value) {
        next[id] = value
        changed = true
      }
    } else if (id in next) {
      delete next[id]
      changed = true
    }
  }
  if (!changed) return
  await setSecret(PROVIDER_API_KEYS_FIELD, Object.keys(next).length ? JSON.stringify(next) : '')
}

ipcMain.handle('getAppSettings', async () => {
  await loadEncryptedSecrets()
  // API keys never cross the process boundary (project rule): the settings
  // page reads a provider's saved key via get-provider-api-key instead.
  return { ...settings, apiKey: '', providerApiKey: '' }
})

/**
 * Whitelist for the renderer's settings sync: unknown keys are stripped and
 * every field is type-checked, so an arbitrary (or `__proto__`) key can never
 * land on the settings singleton via Object.assign.
 */
const settingsPatchSchema = z
  .object({
    providerId: z.string(),
    providerKind: z.enum(['openai', 'generic', 'deepseek', 'zhipu', 'qwen']),
    apiBaseURL: z.string(),
    apiKey: z.string(),
    model: z.string(),
    customPrompt: z.string(),
    reasoningEffort: z.enum(['off', 'low', 'medium', 'high']),
    screenshotAutoSave: z.boolean(),
    screenshotDir: z.string(),
    localAsrModelSize: z.string(),
    localAsrLanguage: z.string(),
    language: z.enum(['zh-CN', 'en']),
    privacyMode: z.boolean(),
    audioInputDeviceId: z.string()
  })
  .partial()

ipcMain.handle('updateAppSettings', async (_event, _settings: unknown) => {
  const parsed = settingsPatchSchema.safeParse(_settings)
  if (!parsed.success) return
  const patch = parsed.data as Partial<AppSettings>

  const providerId = patch.providerId ?? ''
  const incomingKey = patch.apiKey
  Object.assign(settings, patch)

  if (providerId) {
    // The payload carries the ACTIVE provider's key (empty when the renderer
    // never entered it this session). Only a non-empty incoming key may
    // overwrite the encrypted map — an empty one just falls back to the saved
    // credential instead of wiping it.
    if (incomingKey) await setProviderApiKeys({ [providerId]: incomingKey })
    settings.providerApiKey = incomingKey || (await getProviderApiKeys())[providerId] || ''
    settings.apiKey = settings.providerApiKey
  }

  if (patch.language) {
    setMainLanguage(patch.language)
  }
  if ('privacyMode' in patch) {
    applyPrivacyMode()
  }
})

/**
 * Persist one provider's API key (settings page). Keys never travel through
 * `updateAppSettings`: that payload is the ACTIVE provider's projection and
 * would overwrite other providers' saved credentials.
 */
ipcMain.handle(
  'set-provider-api-key',
  async (_event, payload: { providerId?: unknown; apiKey?: unknown }) => {
    const providerId = typeof payload?.providerId === 'string' ? payload.providerId : ''
    const apiKey = typeof payload?.apiKey === 'string' ? payload.apiKey : ''
    if (!providerId) return { ok: false }
    await setProviderApiKeys({ [providerId]: apiKey })
    if (settings.providerId === providerId) {
      settings.providerApiKey = apiKey
      settings.apiKey = apiKey
    }
    return { ok: true }
  }
)

/** The decrypted key of one provider (settings page shows the saved value). */
ipcMain.handle('get-provider-api-key', async (_event, providerId: unknown) => {
  if (typeof providerId !== 'string' || !providerId) return ''
  return (await getProviderApiKeys())[providerId] ?? ''
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
  /** Provider the renderer has selected (only its key is loaded from secrets). */
  providerId: 'default',
  /** Provider family, decides the native thinking body fields (reasoning-body.ts). */
  providerKind: 'generic' as 'openai' | 'generic' | 'deepseek' | 'zhipu' | 'qwen',
  apiBaseURL: process.env.API_BASE_URL || '',
  /** Effective key of the active provider (loaded from the encrypted map). */
  providerApiKey: process.env.API_KEY || '',
  /** Legacy single-key field, written through updateAppSettings for compatibility. */
  apiKey: process.env.API_KEY || '',
  model: process.env.MODEL || '',
  customPrompt: '',
  /**
   * Deep-thinking effort. ALWAYS honored as selected: the model-list detection
   * only drives a hint in the UI, because most providers publish no reasoning
   * metadata. 'off' sends no generic reasoning parameter (and explicitly
   * disables provider-native thinking where the provider defaults it on).
   */
  reasoningEffort: 'off' as 'off' | 'low' | 'medium' | 'high',
  screenshotAutoSave: false,
  screenshotDir: '',
  localAsrModelSize: 'base' as LocalAsrModelSize,
  localAsrLanguage: 'auto' as LocalAsrLanguage,
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
