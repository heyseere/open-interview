import { globalShortcut, ipcMain, screen } from 'electron'
import type { BrowserWindow, Rectangle } from 'electron'
import { applyContentProtection } from './main-window'
import { settings } from './settings'
import { state, togglePassthrough } from './state'
import { tMain } from './i18n'
import { emitToRenderer, coderPageWindow } from './renderer-send'
import { clearTranscriptionText } from './transcription'
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

enum ShortcutStatus {
  Registered = 'registered',
  Failed = 'failed',
  /** Shortcut is available to register but not registered. */
  Available = 'available'
}

const MOVE_STEP = 200
const shortcuts: Record<string, Shortcut> = {}

/** Forward an opacity step to the renderer (+1 = more opaque, -1 = more transparent). */
function adjustOpacity(direction: 1 | -1) {
  coderPageWindow()?.webContents.send('adjust-opacity', direction)
}

const FRONT_REASSERT_DURATION = 8000
const FRONT_REASSERT_INTERVAL = 200
const FRONT_RELATIVE_LEVEL = 100
const BACKGROUND_GUARD_INTERVAL = 3000
let frontReassertTimer: NodeJS.Timeout | null = null
let backgroundGuardTimer: NodeJS.Timeout | null = null
let isWindowSoftHidden = false
let softHiddenBounds: Rectangle | null = null

/**
 * Reassert always-on-top. `aggressive` also calls moveTop() which
 * brings the window above everything — only use on explicit user actions
 * (show, screenshot, etc.) to avoid disturbing interaction with other apps.
 * A no-op unless privacy mode is on: with the switch off the window is a
 * plain normal window and must never be forced back on top (the posture
 * lives in settings.applyWindowPosture).
 */
function applyTopMost(win: BrowserWindow, aggressive = true) {
  if (!win || win.isDestroyed()) return
  if (!settings.privacyMode) return
  win.setAlwaysOnTop(true, 'screen-saver', FRONT_RELATIVE_LEVEL)
  if (aggressive) win.moveTop()
}

/**
 * Start a persistent low-frequency background guard that continuously
 * re-asserts always-on-top while the window is visible.
 * Uses the non-aggressive variant so it won't steal focus or
 * interfere with the user's interaction with other windows.
 */
function startBackgroundGuard(window: BrowserWindow) {
  if (backgroundGuardTimer) return // already running
  backgroundGuardTimer = setInterval(() => {
    if (!window || window.isDestroyed() || !window.isVisible()) {
      stopBackgroundGuard()
      return
    }
    applyTopMost(window, false)
    // Re-assert stealth too: some platforms/apps can silently reset it
    applyContentProtection(window)
  }, BACKGROUND_GUARD_INTERVAL)
}

function stopBackgroundGuard() {
  if (backgroundGuardTimer) {
    clearInterval(backgroundGuardTimer)
    backgroundGuardTimer = null
  }
}

function stopFrontReassert() {
  if (frontReassertTimer) {
    clearInterval(frontReassertTimer)
    frontReassertTimer = null
  }
}

function getOffscreenBounds(window: BrowserWindow): Rectangle {
  const displays = screen.getAllDisplays()
  const maxRight = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const topMost = Math.min(...displays.map((display) => display.bounds.y))
  const [width, height] = window.getSize()

  return {
    x: maxRight + 2000,
    y: topMost,
    width,
    height
  }
}

function softHideWindow(window: BrowserWindow) {
  if (isWindowSoftHidden || window.isDestroyed()) return

  stopFrontReassert()
  stopBackgroundGuard()
  softHiddenBounds = window.getBounds()
  isWindowSoftHidden = true

  window.setOpacity(0)
  window.setIgnoreMouseEvents(true)
  window.setBounds(getOffscreenBounds(window))
}

function restoreSoftHiddenWindow(window: BrowserWindow) {
  if (!isWindowSoftHidden || !softHiddenBounds || window.isDestroyed()) return

  applyContentProtection(window, true)
  window.setBounds(softHiddenBounds)
  window.setIgnoreMouseEvents(state.ignoreMouse, { forward: true })
  window.setOpacity(1)

  isWindowSoftHidden = false
  softHiddenBounds = null
  keepWindowInFront(window)
}

function showMainWindow(window: BrowserWindow) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    window.showInactive()
  } else {
    window.show()
  }

  applyContentProtection(window, process.platform === 'win32')
  keepWindowInFront(window)
}

function keepWindowInFront(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return
  if (frontReassertTimer) {
    clearInterval(frontReassertTimer)
    frontReassertTimer = null
  }

  const start = Date.now()
  const reassert = () => {
    // isDestroyed FIRST: isVisible on a destroyed window throws, and this
    // timer keeps firing every 200ms for a short burst after each show.
    if (window.isDestroyed() || !window.isVisible()) return false
    applyTopMost(window)
    return true
  }

  if (!reassert()) return

  // Aggressive burst: rapid reasserts for a short period
  frontReassertTimer = setInterval(() => {
    const shouldStop = Date.now() - start > FRONT_REASSERT_DURATION
    if (shouldStop || !reassert()) {
      if (frontReassertTimer) {
        clearInterval(frontReassertTimer)
        frontReassertTimer = null
      }
    }
  }, FRONT_REASSERT_INTERVAL)

  // Ensure background guard is running for persistent protection (stealth
  // mode only — a normal window needs no guard)
  if (settings.privacyMode) startBackgroundGuard(window)
}

/** Nudge the window by a delta, clamped by the window manager. */
function moveWindowBy(dx: number, dy: number): void {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(x + dx, y + dy)
}

const callbacks: Record<string, () => void> = {
  hideOrShowMainWindow: async () => {
    const mainWindow = global.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (process.platform === 'win32') {
      if (isWindowSoftHidden) {
        restoreSoftHiddenWindow(mainWindow)
        return
      }

      if (!mainWindow.isVisible()) {
        showMainWindow(mainWindow)
        return
      }

      softHideWindow(mainWindow)
      return
    }

    if (mainWindow.isVisible()) {
      stopBackgroundGuard()
      mainWindow.hide()
    } else {
      // 重新显示时不断重申置顶属性，抵消其他前台软件持续抢占
      showMainWindow(mainWindow)
    }
  },

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
