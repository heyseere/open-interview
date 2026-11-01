import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain, screen, shell, BrowserWindow } from 'electron'
import type { Rectangle } from 'electron'
import { is } from '@electron-toolkit/utils'
import { state } from './state'
import { applyWindowPosture, settings } from './settings'
import { sanitizeWindowBounds, type WindowBounds } from './window-bounds'

/**
 * Re-assert capture protection according to the privacy switch. Callers run
 * this repeatedly (window show, background guard) because some Windows
 * captures silently lose the flag — `settings.privacyMode` decides whether
 * the window is invisible to screen sharing/recording.
 */
export function applyContentProtection(window: BrowserWindow, forceReset = false): void {
  if (!window || window.isDestroyed()) return

  if (forceReset && process.platform === 'win32' && settings.privacyMode) {
    window.setContentProtection(false)
  }

  window.setContentProtection(settings.privacyMode)
}

// --- Window posture: keep-in-front, background guard, show/hide -------------
// Lives here (not in shortcuts.ts) because it is window management that also
// serves non-shortcut callers; shortcuts.ts only keeps the Alt+M entry point.

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

/**
 * Show/hide the main window (Alt+M, the header button and the hover toolbar
 * all land here). On Windows a hide parks the window far offscreen with
 * opacity 0 ("soft hide") instead of a plain hide(); see softHideWindow /
 * restoreSoftHiddenWindow for the bounds bookkeeping.
 */
export function hideOrShowMainWindow(): void {
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
}

const STANDARD_WIDTH = 900
const STANDARD_HEIGHT = 670
const MINI_MIN_WIDTH = 240
const MINI_MIN_HEIGHT = 64

/**
 * Resize the frameless window (compact panel grip), anchored to the
 * current top-left corner and clamped to the visible work area.
 */
function clampToWorkArea(width: number, height: number): { width: number; height: number } {
  const workArea = screen.getPrimaryDisplay().workArea
  const maxWidth = Math.max(MINI_MIN_WIDTH, workArea.width - workArea.x * 2)
  return {
    width: Math.min(Math.max(Math.round(width), MINI_MIN_WIDTH), maxWidth),
    height: Math.min(Math.max(Math.round(height), MINI_MIN_HEIGHT), workArea.height)
  }
}

ipcMain.handle('set-window-size', (_event, size: { width?: unknown; height?: unknown }) => {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Number.isFinite rejects NaN/Infinity, which would otherwise travel
  // through clampToWorkArea's min/max chain straight into setBounds and throw.
  const width =
    typeof size?.width === 'number' && Number.isFinite(size.width) ? size.width : STANDARD_WIDTH
  const height =
    typeof size?.height === 'number' && Number.isFinite(size.height) ? size.height : STANDARD_HEIGHT
  const [x, y] = mainWindow.getPosition()
  mainWindow.setBounds({ x, y, ...clampToWorkArea(width, height) })
})

/** Schemes a renderer may ask the OS to open; everything else is dropped. */
const OPENABLE_URL_PROTOCOLS = new Set(['https:', 'http:'])

ipcMain.handle('open-external', (_event, url: unknown) => {
  if (typeof url !== 'string') return
  try {
    const { protocol } = new URL(url)
    if (OPENABLE_URL_PROTOCOLS.has(protocol)) void shell.openExternal(url)
  } catch {
    // Unparseable URL: ignore
  }
})

// --- Window bounds persistence (position + size across restarts) -----------

const BOUNDS_SAVE_DELAY_MS = 500
const boundsFilePath = (): string => join(app.getPath('userData'), 'window-bounds.json')
let boundsSaveTimer: NodeJS.Timeout | null = null

function loadWindowBounds(): WindowBounds | null {
  try {
    return sanitizeWindowBounds(
      JSON.parse(readFileSync(boundsFilePath(), 'utf-8')),
      screen.getAllDisplays()
    )
  } catch {
    return null
  }
}

function persistWindowBounds(window: BrowserWindow): void {
  if (window.isDestroyed() || window.isMaximized() || window.isFullScreen()) return
  // The same sanitizer guards the write path, so the Windows soft-hide park
  // position (far offscreen) can never replace the restore bounds on disk
  const bounds = sanitizeWindowBounds(window.getBounds(), screen.getAllDisplays())
  if (!bounds) return
  try {
    writeFileSync(boundsFilePath(), JSON.stringify(bounds))
  } catch {
    // Persistence is best-effort
  }
}

function scheduleWindowBoundsSave(window: BrowserWindow): void {
  if (boundsSaveTimer) clearTimeout(boundsSaveTimer)
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null
    persistWindowBounds(window)
  }, BOUNDS_SAVE_DELAY_MS)
}

export function createWindow(): void {
  // Create the browser window. The window starts as a plain normal window:
  // the privacy switch (stealth overlay vs normal window) owns the posture
  // and is applied by the renderer settings sync shortly after mount — the
  // same startup rhythm as the dock visibility below. The last position and
  // size are restored when the persisted bounds are still usable on screen.
  const savedBounds = loadWindowBounds()
  const mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? STANDARD_WIDTH,
    height: savedBounds?.height ?? STANDARD_HEIGHT,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: MINI_MIN_WIDTH,
    minHeight: MINI_MIN_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The preload only uses contextBridge + ipcRenderer, both available to
      // sandboxed preloads — keep the Chromium sandbox ON.
      contextIsolation: true,
      sandbox: true
    }
  })

  // Store reference to mainWindow globally
  global.mainWindow = mainWindow

  mainWindow.on('move', () => scheduleWindowBoundsSave(mainWindow))
  mainWindow.on('resize', () => scheduleWindowBoundsSave(mainWindow))
  mainWindow.on('close', () => {
    if (boundsSaveTimer) {
      clearTimeout(boundsSaveTimer)
      boundsSaveTimer = null
    }
    persistWindowBounds(mainWindow)
  })

  // Apply content protection as early as possible — before the window is
  // ever shown — so even a fast first frame cannot leak into a capture.
  applyContentProtection(mainWindow)

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    applyWindowPosture(mainWindow)
    // Dock visibility is handled at startup (index.ts) and via renderer sync
    // (settings.ts); the window's own show event must not force it back on.
    applyContentProtection(mainWindow)

    // Reclaim top position when other apps steal it (stealth overlay mode
    // only — a normal window is allowed to stay buried)
    mainWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (
        settings.privacyMode &&
        !isAlwaysOnTop &&
        mainWindow.isVisible() &&
        !mainWindow.isDestroyed()
      ) {
        // Only re-set the flag; avoid moveTop() to not disturb other window focus
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })
  })

  mainWindow.on('show', () => {
    applyContentProtection(mainWindow)
  })

  // Renderer-initiated popups never open in-window: real web URLs go to the
  // system browser, every other scheme is dropped.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const { protocol } = new URL(details.url)
      if (OPENABLE_URL_PROTOCOLS.has(protocol)) void shell.openExternal(details.url)
    } catch {
      // Unparseable URL: deny
    }
    return { action: 'deny' }
  })

  // Single-page app: block same-window navigation outright. Answers render
  // links from untrusted captured content; a successful navigation would run
  // a remote document with this window's preload bridge attached.
  // loadURL/loadFile do not emit this event, so the initial load is safe.
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Startup marker for the smoke test: a main-process crash during module
  // init surfaces as a modal error dialog (no stdout output), so the packaged
  // app must prove it reached window creation for `npm run smoke` to pass.
  console.log('[startup] window created')
}
