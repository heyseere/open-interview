import { join } from 'node:path'
import { ipcMain, screen, shell, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { settings } from './settings'

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

const STANDARD_WIDTH = 900
const STANDARD_HEIGHT = 670
export const MINI_MIN_WIDTH = 240
export const MINI_MIN_HEIGHT = 64

/**
 * Resize the frameless window (mini-layout drag handle), anchored to the
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
  const width = typeof size?.width === 'number' ? size.width : STANDARD_WIDTH
  const height = typeof size?.height === 'number' ? size.height : STANDARD_HEIGHT
  const [x, y] = mainWindow.getPosition()
  mainWindow.setBounds({ x, y, ...clampToWorkArea(width, height) })
})

export function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: STANDARD_WIDTH,
    height: STANDARD_HEIGHT,
    minWidth: MINI_MIN_WIDTH,
    minHeight: MINI_MIN_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Store reference to mainWindow globally
  global.mainWindow = mainWindow

  // Apply content protection as early as possible — before the window is
  // ever shown — so even a fast first frame cannot leak into a capture.
  applyContentProtection(mainWindow)

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Dock visibility is handled at startup (index.ts) and via renderer sync
    // (settings.ts); the window's own show event must not force it back on.
    applyContentProtection(mainWindow)

    // Reclaim top position when other apps steal it
    mainWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (!isAlwaysOnTop && mainWindow.isVisible() && !mainWindow.isDestroyed()) {
        // Only re-set the flag; avoid moveTop() to not disturb other window focus
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })
  })

  mainWindow.on('show', () => {
    applyContentProtection(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
