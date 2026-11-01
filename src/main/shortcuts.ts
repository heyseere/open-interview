import { globalShortcut, ipcMain } from 'electron'
import { hideOrShowMainWindow } from './main-window'
import { togglePassthrough } from './state'
import { tMain } from './i18n'
import { emitToRenderer, coderPageWindow } from './renderer-send'
import { clearTranscriptionText } from './transcription'
import { ShortcutStatus } from '../shared/shortcut-status'
import {
  startNewScreenshotSession,
  appendScreenshotSession,
  stopCurrentStream,
  startNewConversation,
  submitFullPageCapture
} from './streaming'

type Shortcut = {
  action: string
  key: string
  status: ShortcutStatus
  registeredKeys: string[]
}

const MOVE_STEP = 200
const shortcuts: Record<string, Shortcut> = {}

/** Forward an opacity step to the renderer (+1 = more opaque, -1 = more transparent). */
function adjustOpacity(direction: 1 | -1) {
  coderPageWindow()?.webContents.send('adjust-opacity', direction)
}

/** Nudge the window by a delta, clamped by the window manager. */
function moveWindowBy(dx: number, dy: number): void {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + dx, y + dy)
}

const callbacks: Record<string, () => void> = {
  // Show/hide posture (incl. the Windows soft-hide park) lives in
  // main-window.ts; this entry is just the shortcut/hover-toolbar hook.
  hideOrShowMainWindow,

  // Screenshot + AI streaming live in src/main/streaming.ts
  takeScreenshot: async () => {
    await startNewScreenshotSession()
  },

  appendScreenshot: async () => {
    await appendScreenshotSession()
  },

  // Full-page capture of the dedicated exam Chrome (see chrome-fullpage.ts)
  captureFullPage: async () => {
    await submitFullPageCapture()
  },

  // Stop current AI solution stream
  stopSolutionStream: () => {
    stopCurrentStream()
  },

  // The follow-up dialog is renderer-side; just forward the open request
  followUpQuestion: () => {
    coderPageWindow()?.webContents.send('open-follow-up')
  },

  ignoreOrEnableMouse: () => {
    if (!coderPageWindow()) return
    // One implementation shared with the header button (state.ts): flipping
    // the intent here and there must never drift apart.
    togglePassthrough()
  },
  pageUp: () => {
    coderPageWindow()?.webContents.send('scroll-page-up')
  },

  pageDown: () => {
    coderPageWindow()?.webContents.send('scroll-page-down')
  },

  moveMainWindowUp: () => moveWindowBy(0, -MOVE_STEP),

  moveMainWindowDown: () => moveWindowBy(0, MOVE_STEP),

  moveMainWindowLeft: () => moveWindowBy(-MOVE_STEP, 0),

  moveMainWindowRight: () => moveWindowBy(MOVE_STEP, 0),

  toggleTranscription: () => {
    coderPageWindow()?.webContents.send('toggle-transcription')
  },

  clearTranscription: () => {
    clearTranscriptionText()
    coderPageWindow()?.webContents.send('transcription-cleared')
  },

  // Cycle prompt scenes; the renderer owns the scene list and toasts the
  // newly active one (the header dropdown mirrors the same state)
  switchScene: () => {
    coderPageWindow()?.webContents.send('cycle-prompt-scene')
  },

  // Step the window opacity up/down; the renderer applies it to its own
  // store (which persists and re-renders the faded layer)
  opacityUp: () => adjustOpacity(1),

  opacityDown: () => adjustOpacity(-1),

  // Flip between the standard layout and the compact panel (the renderer
  // owns uiLayout and reshapes the window)
  toggleMiniMode: () => {
    coderPageWindow()?.webContents.send('toggle-mini-mode')
  }
}

/**
 * Whitelisted renderer-triggered actions (hover toolbar). Transcription is
 * routed through the existing `toggle-transcription` event so the renderer
 * pipeline (incl. VAD arming) stays in one place. Any other shortcut action
 * falls through to the callbacks table so mouse-button bindings work for the
 * whole shortcut list.
 */
const TRIGGERABLE_ACTIONS: Record<string, () => void | Promise<void>> = {
  newConversation: () => startNewConversation(),
  // Forwarded to the renderer, which owns the transcription pipeline (incl.
  // VAD arming), so these never call the main-side callbacks directly.
  toggleTranscription: () => emitToRenderer('toggle-transcription'),
  cancelTranscription: () => emitToRenderer('cancel-transcription'),
  submitTranscription: () => emitToRenderer('submit-transcription')
}

ipcMain.handle('trigger-action', async (_event, action: unknown) => {
  const name = typeof action === 'string' ? action : ''
  const handler = TRIGGERABLE_ACTIONS[name] ?? callbacks[name]
  if (!handler) return { success: false, error: tMain('err.unknownAction') }
  try {
    await handler()
    return { success: true }
  } catch (error) {
    console.error(`Action ${String(name)} failed:`, error)
    return { success: false, error: tMain('err.actionFailed') }
  }
})

function unregisterShortcut(action: string) {
  const shortcut = shortcuts[action]
  if (!shortcut) return
  if (shortcut.registeredKeys.length) {
    shortcut.registeredKeys.forEach((registeredKey) => {
      globalShortcut.unregister(registeredKey)
    })
  } else {
    globalShortcut.unregister(shortcut.key)
  }
  shortcut.status = ShortcutStatus.Available
  shortcut.registeredKeys = []
}

function getShortcutRegistrationKeys(key: string) {
  const keys = [key]
  if (process.platform !== 'win32') {
    return keys
  }
  const parts = key.split('+')
  const hasAlt = parts.includes('Alt')
  const hasCtrl = parts.includes('CommandOrControl') || parts.includes('Control')
  if (hasAlt && !hasCtrl) {
    const aliasParts = [...parts]
    const altIndex = aliasParts.indexOf('Alt')
    if (altIndex >= 0) {
      aliasParts.splice(altIndex, 0, 'CommandOrControl')
      const aliasKey = aliasParts.join('+')
      if (!keys.includes(aliasKey)) {
        keys.push(aliasKey)
      }
    }
  }
  return keys
}

/**
 * Register one action's accelerator.
 *
 * `globalShortcut.register` returns false when another application (or the OS)
 * already owns the combination — that is the ONLY way to detect a real
 * conflict: Electron does not expose a "who owns this key" query, and
 * `isRegistered` only reports OUR registrations. The failure is reported back
 * to the renderer so the settings page can flag the row.
 */
function registerShortcut(action: string, key: string): boolean {
  if (shortcuts[action]) {
    unregisterShortcut(action)
  }

  // An unknown action would register an `undefined` callback that throws
  // inside Electron when the key fires — report it as Failed instead.
  if (typeof callbacks[action] !== 'function') {
    shortcuts[action] = {
      action,
      key,
      status: ShortcutStatus.Failed,
      registeredKeys: []
    }
    return false
  }

  const keysToRegister = getShortcutRegistrationKeys(key)
  const registeredKeys: string[] = []
  keysToRegister.forEach((shortcutKey) => {
    try {
      if (globalShortcut.register(shortcutKey, callbacks[action])) {
        registeredKeys.push(shortcutKey)
      }
    } catch (error) {
      // An accelerator Electron cannot even parse THROWS instead of returning
      // false ("conversion failure from …"). Treat it as a failed binding so
      // the renderer can flag the row — previously the whole IPC rejected and
      // the recorder stayed silent about why nothing happened.
      console.warn(`Invalid accelerator for ${action}: ${shortcutKey}`, error)
    }
  })

  shortcuts[action] = {
    action,
    key,
    status: registeredKeys.length ? ShortcutStatus.Registered : ShortcutStatus.Failed,
    registeredKeys
  }
  return registeredKeys.length > 0
}

/** Registration outcome per action, in the shape the renderer store expects. */
function registrationReport(): Record<string, ShortcutStatus> {
  return Object.fromEntries(
    Object.entries(shortcuts).map(([action, shortcut]) => [action, shortcut.status])
  )
}

function unregisterAll() {
  Object.keys(shortcuts).forEach((action) => unregisterShortcut(action))
}

ipcMain.handle(
  'initShortcuts',
  (_event, payload: { shortcuts: Record<string, { action: string; key: string }> }) => {
    // Re-init is safe: always start from a clean slate.
    unregisterAll()
    Object.entries(payload?.shortcuts ?? {}).forEach(([action, binding]) => {
      if (typeof binding?.key !== 'string') return
      registerShortcut(action, binding.key)
    })
    return registrationReport()
  }
)

ipcMain.handle('updateShortcuts', (_event, _shortcuts: { action: string; key: string }[]) => {
  if (Array.isArray(_shortcuts)) {
    _shortcuts.forEach((shortcut) => {
      if (typeof shortcut?.key !== 'string') return
      if (shortcuts[shortcut.action]?.key !== shortcut.key) {
        registerShortcut(shortcut.action, shortcut.key)
      }
    })
  }
  return registrationReport()
})
