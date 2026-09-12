import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../main/settings'
import type { AppState } from '../main/state'
import type {
  TranscriptionError,
  TranscriptionProgress,
  TranscriptionStartOptions,
  TranscriptionStopResult
} from '../main/transcription'
import type {
  LocalAsrSetupProgress,
  LocalAsrSetupResult,
  LocalAsrStatus
} from '../main/whisper-cpp'

// Custom APIs for renderer
const api = {
  // Get app settings
  getAppSettings: () => ipcRenderer.invoke('getAppSettings'),
  // Update app settings
  updateAppSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('updateAppSettings', settings),
  listOpenAIModels: (config: { baseURL: string; apiKey: string }) =>
    ipcRenderer.invoke('list-openai-models', config) as Promise<string[]>,

  // Update app state
  updateAppState: (state: Partial<AppState>) => ipcRenderer.invoke('updateAppState', state),
  // Listen for app state
  onSyncAppState: (callback: (state: AppState) => void) => {
    ipcRenderer.on('sync-app-state', (_event, state) => {
      callback(state)
    })
  },
  // Remove app state listener
  removeSyncAppStateListener: () => {
    ipcRenderer.removeAllListeners('sync-app-state')
  },

  // Init shortcuts (re-init is safe: the main process unregisters everything
  // first)
  initShortcuts: (payload: { shortcuts: Record<string, { action: string; key: string }> }) =>
    ipcRenderer.invoke('initShortcuts', payload),
  // Get shortcuts
  // Update shortcuts
  updateShortcuts: (shortcuts: { action: string; key: string }[]) =>
    ipcRenderer.invoke('updateShortcuts', shortcuts),

  // Listen for screenshot events
  onScreenshotTaken: (callback: (screenshotData: string) => void) => {
    ipcRenderer.on('screenshot-taken', (_event, screenshotData) => {
      callback(screenshotData)
    })
  },
  // Remove screenshot listener
  removeScreenshotListener: () => {
    ipcRenderer.removeAllListeners('screenshot-taken')
  },

  // Listen for solution chunks
  onSolutionChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('solution-chunk', (_event, chunk) => {
      callback(chunk)
    })
  },
  // Remove solution chunk listener
  removeSolutionChunkListener: () => {
    ipcRenderer.removeAllListeners('solution-chunk')
  },

  // Stop solution stream
  stopSolutionStream: () => ipcRenderer.invoke('stopSolutionStream'),

  // Retry the most recent AI request (after failure or manual stop)
  retrySolutionStream: () =>
    ipcRenderer.invoke('retry-solution-stream') as Promise<{ success: boolean; error?: string }>,

  // Drop the current conversation entirely
  newConversation: () => ipcRenderer.invoke('new-conversation'),

  // Conversation history archive (text-only)
  listConversations: () => ipcRenderer.invoke('list-conversations'),
  getConversation: (id: string) => ipcRenderer.invoke('get-conversation', id),
  deleteConversation: (id: string) => ipcRenderer.invoke('delete-conversation', id),

  // Send follow-up question
  sendFollowUpQuestion: (question: string) => ipcRenderer.invoke('sendFollowUpQuestion', question),
  sendTextMessage: (text: string) => ipcRenderer.invoke('send-text-message', text),
  hasActiveConversation: () => ipcRenderer.invoke('has-active-conversation') as Promise<boolean>,

  // Listen for solution completion
  onSolutionComplete: (callback: () => void) => {
    ipcRenderer.on('solution-complete', callback)
  },
  removeSolutionCompleteListener: () => {
    ipcRenderer.removeAllListeners('solution-complete')
  },

  onSolutionStopped: (callback: () => void) => {
    ipcRenderer.on('solution-stopped', callback)
  },
  removeSolutionStoppedListener: () => {
    ipcRenderer.removeAllListeners('solution-stopped')
  },

  onSolutionError: (callback: (message: string) => void) => {
    ipcRenderer.on('solution-error', (_event, message) => {
      callback(message)
    })
  },
  removeSolutionErrorListener: () => {
    ipcRenderer.removeAllListeners('solution-error')
  },

  // Listen for scroll page up
  onScrollPageUp: (callback: () => void) => {
    ipcRenderer.on('scroll-page-up', callback)
  },
  // Remove scroll page up listener
  removeScrollPageUpListener: () => {
    ipcRenderer.removeAllListeners('scroll-page-up')
  },

  // Listen for screenshots-updated (gallery)
  onScreenshotsUpdated: (callback: (screenshots: string[]) => void) => {
    ipcRenderer.on('screenshots-updated', (_event, screenshots) => {
      callback(screenshots)
    })
  },
  removeScreenshotsUpdatedListener: () => {
    ipcRenderer.removeAllListeners('screenshots-updated')
  },

  // Listen for scroll page down
  onScrollPageDown: (callback: () => void) => {
    ipcRenderer.on('scroll-page-down', callback)
  },
  // Remove scroll page down listener
  removeScrollPageDownListener: () => {
    ipcRenderer.removeAllListeners('scroll-page-down')
  },

  // AI loading events
  onAiLoadingStart: (callback: () => void) => {
    ipcRenderer.on('ai-loading-start', callback)
  },
  onAiLoadingEnd: (callback: () => void) => {
    ipcRenderer.on('ai-loading-end', callback)
  },
  removeAiLoadingStartListener: () => {
    ipcRenderer.removeAllListeners('ai-loading-start')
  },
  removeAiLoadingEndListener: () => {
    ipcRenderer.removeAllListeners('ai-loading-end')
  },

  // Solution clear event (new session)
  onSolutionClear: (callback: () => void) => {
    ipcRenderer.on('solution-clear', callback)
  },
  removeSolutionClearListener: () => {
    ipcRenderer.removeAllListeners('solution-clear')
  },

  // Select screenshot save directory
  selectScreenshotDir: () => ipcRenderer.invoke('selectScreenshotDir') as Promise<string | null>,

  // Resize the frameless window (mini layout drag handle)
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.invoke('set-window-size', { width, height }),

  // Toggle between standard and mini layouts via global shortcut
  onToggleMiniMode: (callback: () => void) => {
    ipcRenderer.on('toggle-mini-mode', callback)
  },
  removeToggleMiniModeListener: () => {
    ipcRenderer.removeAllListeners('toggle-mini-mode')
  },

  // Trigger a screenshot/AI action from renderer UI (hover toolbar)
  triggerAction: (action: string) =>
    ipcRenderer.invoke('trigger-action', action) as Promise<{
      success: boolean
      error?: string
    }>,

  // Transcription
  startTranscription: (options: TranscriptionStartOptions) =>
    ipcRenderer.invoke('start-transcription', options) as Promise<void>,
  /** Ask the OS (macOS TCC) for mic / screen-recording access on the app's behalf */
  ensureMediaPermissions: () =>
    ipcRenderer.invoke('ensure-media-permissions') as Promise<{
      microphone: string
      screen: string
    }>,
  /** Read-only permission status snapshot for the permissions page (never prompts) */
  getMediaPermissionStatus: () =>
    ipcRenderer.invoke('get-media-permission-status') as Promise<{
      microphone: string
      screen: string
    }>,
  /** Deep-link into the matching macOS System Settings privacy pane */
  openPrivacySettings: (pane: 'microphone' | 'screen') =>
    ipcRenderer.invoke('open-privacy-settings', pane) as Promise<void>,
  /** Whether the app runs packaged (TCC prompts can only be owned then). */
  getAppInfo: () =>
    ipcRenderer.invoke('get-app-info') as Promise<{ isPackaged: boolean; platform: string }>,
  stopTranscription: () =>
    ipcRenderer.invoke('stop-transcription') as Promise<TranscriptionStopResult>,
  /** One-click local ASR setup (whisper-cli engine + ggml model download).
   * Progress streams through onLocalAsrSetupProgress; resolves when done. */
  setupLocalAsr: (modelSize: string) =>
    ipcRenderer.invoke('setup-local-asr', modelSize) as Promise<LocalAsrSetupResult>,
  /** Environment snapshot for the local ASR status card (never installs). */
  localAsrStatus: (modelSize: string) =>
    ipcRenderer.invoke('local-asr-status', modelSize) as Promise<LocalAsrStatus>,
  /** Abort the running local ASR setup job. */
  cancelLocalAsrSetup: () => ipcRenderer.invoke('cancel-local-asr-setup') as Promise<void>,
  onLocalAsrSetupProgress: (callback: (progress: LocalAsrSetupProgress) => void) => {
    ipcRenderer.on('local-asr-setup-progress', (_event, progress) => callback(progress))
  },
  removeLocalAsrSetupProgressListener: () => {
    ipcRenderer.removeAllListeners('local-asr-setup-progress')
  },
  sendTranscriptionAudioChunk: (chunk: ArrayBuffer) =>
    ipcRenderer.send('transcription-audio-chunk', chunk),
  getTranscriptionText: () => ipcRenderer.invoke('get-transcription-text') as Promise<string>,
  clearTranscriptionText: () => ipcRenderer.invoke('clear-transcription-text') as Promise<void>,

  onToggleTranscription: (callback: () => void) => {
    ipcRenderer.on('toggle-transcription', callback)
  },
  removeToggleTranscriptionListener: () => {
    ipcRenderer.removeAllListeners('toggle-transcription')
  },
  onCancelTranscription: (callback: () => void) => {
    ipcRenderer.on('cancel-transcription', callback)
  },
  removeCancelTranscriptionListener: () => {
    ipcRenderer.removeAllListeners('cancel-transcription')
  },
  onSubmitTranscription: (callback: () => void) => {
    ipcRenderer.on('submit-transcription', callback)
  },
  removeSubmitTranscriptionListener: () => {
    ipcRenderer.removeAllListeners('submit-transcription')
  },
  onOpenFollowUp: (callback: () => void) => {
    ipcRenderer.on('open-follow-up', callback)
  },
  removeOpenFollowUpListener: () => {
    ipcRenderer.removeAllListeners('open-follow-up')
  },
  onTranscriptionText: (callback: (data: { text: string }) => void) => {
    ipcRenderer.on('transcription-text', (_event, data) => callback(data))
  },
  removeTranscriptionTextListener: () => {
    ipcRenderer.removeAllListeners('transcription-text')
  },
  onTranscriptionError: (callback: (error: TranscriptionError) => void) => {
    ipcRenderer.on('transcription-error', (_event, error) => callback(error))
  },
  removeTranscriptionErrorListener: () => {
    ipcRenderer.removeAllListeners('transcription-error')
  },
  onTranscriptionStopped: (callback: () => void) => {
    ipcRenderer.on('transcription-stopped', callback)
  },
  removeTranscriptionStoppedListener: () => {
    ipcRenderer.removeAllListeners('transcription-stopped')
  },
  onTranscriptionCleared: (callback: () => void) => {
    ipcRenderer.on('transcription-cleared', callback)
  },
  removeTranscriptionClearedListener: () => {
    ipcRenderer.removeAllListeners('transcription-cleared')
  },
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => {
    ipcRenderer.on('transcription-progress', (_event, progress) => callback(progress))
  },
  removeTranscriptionProgressListener: () => {
    ipcRenderer.removeAllListeners('transcription-progress')
  }
}

export type MainAPI = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
