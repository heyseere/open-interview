import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../main/settings'
import type { AppState } from '../main/state'
import type {
  TranscriptionError,
  TranscriptionStartOptions,
  TranscriptionStopResult
} from '../main/transcription'
import type {
  LocalAsrSetupProgress,
  LocalAsrSetupResult,
  LocalAsrStatus
} from '../main/whisper-server'
import type { OpenAIModelInfo } from '../main/openai-models'
import type { ConversationRecord, ConversationSummary } from '../main/conversation'
import type { SolutionErrorPayload } from '../shared/solution-error'

/** action → registration status returned by initShortcuts / updateShortcuts. */
export type ShortcutRegistrationReport = Record<string, 'registered' | 'failed' | 'available'>

/**
 * Renderer-facing API surface, built from a channel manifest.
 *
 * Security posture is unchanged: channel names stay hard-coded literals in
 * this (isolated) preload, and the renderer only ever receives closures over
 * `ipcRenderer`. The table removes the 27 hand-written
 * `onX`/`removeXListener` pairs that had drifted (13 unwrapping vs 14
 * pass-through listeners).
 */

/** Request/response channels: renderer method name → IPC channel. */
const INVOKE = {
  getAppSettings: 'getAppSettings',
  updateAppSettings: 'updateAppSettings',
  updateAppState: 'updateAppState',
  getAppState: 'getAppState',
  togglePassthrough: 'toggle-passthrough',
  initShortcuts: 'initShortcuts',
  updateShortcuts: 'updateShortcuts',
  listOpenAIModels: 'list-openai-models',
  getProviderApiKey: 'get-provider-api-key',
  setProviderApiKey: 'set-provider-api-key',
  retrySolutionStream: 'retry-solution-stream',
  listConversations: 'list-conversations',
  getConversation: 'get-conversation',
  deleteConversation: 'delete-conversation',
  sendFollowUpQuestion: 'sendFollowUpQuestion',
  sendTextMessage: 'send-text-message',
  hasActiveConversation: 'has-active-conversation',
  selectScreenshotDir: 'selectScreenshotDir',
  setWindowSize: 'set-window-size',
  openExternal: 'open-external',
  testAiConnection: 'test-ai-connection',
  triggerAction: 'trigger-action',
  getChromeFullPageStatus: 'get-chrome-fullpage-status',
  launchDebugChrome: 'launch-debug-chrome',
  startTranscription: 'start-transcription',
  ensureMediaPermissions: 'ensure-media-permissions',
  getMediaPermissionStatus: 'get-media-permission-status',
  openPrivacySettings: 'open-privacy-settings',
  openExternalUrl: 'open-external-url',
  getAppInfo: 'get-app-info',
  stopTranscription: 'stop-transcription',
  setupLocalAsr: 'setup-local-asr',
  localAsrStatus: 'local-asr-status',
  cancelLocalAsrSetup: 'cancel-local-asr-setup',
  getTranscriptionText: 'get-transcription-text',
  clearTranscriptionText: 'clear-transcription-text'
} as const

/**
 * Push channels: renderer method name (without the `on` prefix) → channel.
 * Listeners that CONSUME an argument unwrap `(_event, payload)`; the rest pass
 * the event through to the callback (previously an inconsistent 13/14 split).
 */
const LISTEN = {
  SyncAppState: { channel: 'sync-app-state', unwrap: true, payload: null as AppState | null },
  ScreenshotTaken: { channel: 'screenshot-taken', unwrap: true, payload: null as string | null },
  SolutionChunk: { channel: 'solution-chunk', unwrap: true, payload: null as string | null },
  SolutionComplete: { channel: 'solution-complete', unwrap: false },
  SolutionStopped: { channel: 'solution-stopped', unwrap: false },
  SolutionError: {
    channel: 'solution-error',
    unwrap: true,
    payload: null as SolutionErrorPayload | null
  },
  SolutionClear: { channel: 'solution-clear', unwrap: false },
  ScrollPageUp: { channel: 'scroll-page-up', unwrap: false },
  ScrollPageDown: { channel: 'scroll-page-down', unwrap: false },
  ScreenshotsUpdated: {
    channel: 'screenshots-updated',
    unwrap: true,
    payload: null as string[] | null
  },
  AiLoadingStart: { channel: 'ai-loading-start', unwrap: false },
  AiLoadingEnd: { channel: 'ai-loading-end', unwrap: false },
  ToggleMiniMode: { channel: 'toggle-mini-mode', unwrap: false },
  CyclePromptScene: { channel: 'cycle-prompt-scene', unwrap: false },
  AdjustOpacity: { channel: 'adjust-opacity', unwrap: true, payload: null as number | null },
  UiNotify: { channel: 'ui-notify', unwrap: true, payload: null as string | null },
  ExamChromeState: {
    channel: 'exam-chrome-state',
    unwrap: true,
    payload: null as { running: boolean; port: number | null } | null
  },
  LocalAsrSetupProgress: {
    channel: 'local-asr-setup-progress',
    unwrap: true,
    payload: null as LocalAsrSetupProgress | null
  },
  ToggleTranscription: { channel: 'toggle-transcription', unwrap: false },
  CancelTranscription: { channel: 'cancel-transcription', unwrap: false },
  SubmitTranscription: { channel: 'submit-transcription', unwrap: false },
  OpenFollowUp: { channel: 'open-follow-up', unwrap: false },
  TranscriptionText: {
    channel: 'transcription-text',
    unwrap: true,
    payload: null as { text: string } | null
  },
  TranscriptionError: {
    channel: 'transcription-error',
    unwrap: true,
    payload: null as TranscriptionError | null
  },
  TranscriptionStopped: { channel: 'transcription-stopped', unwrap: false },
  TranscriptionCleared: { channel: 'transcription-cleared', unwrap: false },
  TranscriptionPartial: {
    channel: 'transcription-partial',
    unwrap: true,
    payload: null as { text: string } | null
  }
} as const

function invoke(method: keyof typeof INVOKE, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(INVOKE[method], ...args)
}

/** Callback signature derived from a table entry's `payload`. */
type ListenCallback<K extends keyof typeof LISTEN> = (typeof LISTEN)[K] extends { payload: infer P }
  ? (payload: NonNullable<P>) => void
  : () => void

type Listeners = {
  [K in keyof typeof LISTEN as `on${K}`]: (callback: ListenCallback<K>) => void
} & {
  [K in keyof typeof LISTEN as `remove${K}Listener`]: () => void
}

function buildListeners(): Listeners {
  const built: Record<string, unknown> = {}
  // Track the wrappers registered per channel so `remove…Listener` detaches
  // exactly those and leaves unrelated channels alone. Per-subscription removal
  // is NOT supported: a channel's cleanup drops EVERY subscription made through
  // this API, so two components must never subscribe to the same channel at
  // once (true across the current codebase — keep it that way).
  const wrappers = new Map<string, Set<(...args: unknown[]) => void>>()
  const track = (channel: string, wrapper: (...args: unknown[]) => void): void => {
    const set = wrappers.get(channel) ?? new Set()
    set.add(wrapper)
    wrappers.set(channel, set)
  }

  for (const [name, spec] of Object.entries(LISTEN)) {
    const { channel, unwrap } = spec as { channel: string; unwrap: boolean }
    built[`on${name}`] = unwrap
      ? (callback: (payload: unknown) => void) => {
          const wrapper = (_event: unknown, payload: unknown): void => callback(payload)
          track(channel, wrapper)
          ipcRenderer.on(channel, wrapper)
        }
      : (callback: () => void) => {
          const wrapper = (): void => callback()
          track(channel, wrapper)
          ipcRenderer.on(channel, wrapper)
        }
    built[`remove${name}Listener`] = () => {
      const set = wrappers.get(channel)
      if (!set) return
      for (const wrapper of set) ipcRenderer.removeListener(channel, wrapper)
      set.clear()
    }
  }
  return built as Listeners
}

/**
 * Typed public surface. Return types are `unknown` where the renderer does not
 * rely on the shape; the few call sites that do cast at the boundary.
 */
const api = {
  // --- settings / state / shortcuts -----------------------------------------
  getAppSettings: () => invoke('getAppSettings') as Promise<AppSettings>,
  updateAppSettings: (settings: Partial<AppSettings>) => invoke('updateAppSettings', settings),
  updateAppState: (state: Partial<AppState>) => invoke('updateAppState', state),
  getAppState: () => invoke('getAppState') as Promise<AppState>,
  /** Flip passthrough intent in main; no argument, so a stale render closure
   * can never re-arm the mode the user just turned off. */
  togglePassthrough: () => invoke('togglePassthrough') as Promise<AppState>,
  initShortcuts: (payload: { shortcuts: Record<string, { action: string; key: string }> }) =>
    invoke('initShortcuts', payload) as Promise<ShortcutRegistrationReport>,
  updateShortcuts: (shortcuts: { action: string; key: string }[]) =>
    invoke('updateShortcuts', shortcuts) as Promise<ShortcutRegistrationReport>,
  listOpenAIModels: (config: { baseURL: string; apiKey: string }) =>
    invoke('listOpenAIModels', config) as Promise<OpenAIModelInfo[]>,
  getProviderApiKey: (providerId: string) =>
    invoke('getProviderApiKey', providerId) as Promise<string>,
  setProviderApiKey: (providerId: string, apiKey: string) =>
    invoke('setProviderApiKey', { providerId, apiKey }) as Promise<{ ok: boolean }>,

  // --- conversation / streaming ---------------------------------------------
  retrySolutionStream: () =>
    invoke('retrySolutionStream') as Promise<{ success: boolean; error?: string }>,
  listConversations: () => invoke('listConversations') as Promise<ConversationSummary[]>,
  getConversation: (id: string) =>
    invoke('getConversation', id) as Promise<ConversationRecord | null>,
  deleteConversation: (id: string) => invoke('deleteConversation', id),
  sendFollowUpQuestion: (question: string) =>
    invoke('sendFollowUpQuestion', question) as Promise<{ success: boolean; error?: string }>,
  sendTextMessage: (text: string) =>
    invoke('sendTextMessage', text) as Promise<{ success: boolean; error?: string }>,
  hasActiveConversation: () => invoke('hasActiveConversation') as Promise<boolean>,
  triggerAction: (action: string) =>
    invoke('triggerAction', action) as Promise<{ success: boolean; error?: string }>,

  // --- window -----------------------------------------------------------------
  selectScreenshotDir: () => invoke('selectScreenshotDir') as Promise<string | null>,
  setWindowSize: (width: number, height: number) => invoke('setWindowSize', { width, height }),
  openExternal: (url: string) => invoke('openExternal', url) as Promise<void>,

  // --- AI / exam Chrome ---------------------------------------------------------
  testAiConnection: () => invoke('testAiConnection') as Promise<{ ok: boolean; error?: string }>,
  getChromeFullPageStatus: () =>
    invoke('getChromeFullPageStatus') as Promise<{
      chromeFound: boolean
      running: boolean
      port: number | null
    }>,
  launchDebugChrome: () =>
    invoke('launchDebugChrome') as Promise<{ ok: boolean; port?: number; error?: string }>,

  // --- permissions --------------------------------------------------------------
  ensureMediaPermissions: () =>
    invoke('ensureMediaPermissions') as Promise<{ microphone: string; screen: string }>,
  getMediaPermissionStatus: () =>
    invoke('getMediaPermissionStatus') as Promise<{ microphone: string; screen: string }>,
  openPrivacySettings: (pane: 'microphone' | 'screen') =>
    invoke('openPrivacySettings', pane) as Promise<void>,
  openExternalUrl: (url: string) => invoke('openExternalUrl', url) as Promise<boolean>,
  getAppInfo: () => invoke('getAppInfo') as Promise<{ isPackaged: boolean; platform: string }>,

  // --- transcription --------------------------------------------------------------
  startTranscription: (options: TranscriptionStartOptions) =>
    invoke('startTranscription', options) as Promise<void>,
  stopTranscription: (options?: { discard?: boolean }) =>
    invoke('stopTranscription', options) as Promise<TranscriptionStopResult>,
  setupLocalAsr: (modelSize: string) =>
    invoke('setupLocalAsr', modelSize) as Promise<LocalAsrSetupResult>,
  localAsrStatus: (modelSize: string) =>
    invoke('localAsrStatus', modelSize) as Promise<LocalAsrStatus>,
  cancelLocalAsrSetup: () => invoke('cancelLocalAsrSetup') as Promise<void>,
  sendTranscriptionAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send('transcription-audio-chunk', chunk),
  getTranscriptionText: () => invoke('getTranscriptionText') as Promise<string>,
  clearTranscriptionText: () => invoke('clearTranscriptionText') as Promise<void>,

  ...buildListeners()
}

export type MainAPI = typeof api

// Use `contextBridge` APIs to expose the manifest-shaped `api` to the
// renderer only if context isolation is enabled, otherwise just add it to
// the DOM global. Raw ipcRenderer access is deliberately NOT exposed: it
// would bypass the channel allowlist entirely.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
