import 'dotenv/config'
import { app, BrowserWindow, desktopCapturer, globalShortcut, session } from 'electron'

type AbortLikeError = {
  name?: string
  code?: string
  message?: unknown
}

// Swallow AbortError from user-initiated stream cancellations to keep console clean
function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const err = error as AbortLikeError
  const message = typeof err.message === 'string' ? err.message : ''
  return err.name === 'AbortError' || err.code === 'ABORT_ERR' || /aborted/i.test(message)
}

process.on('unhandledRejection', (error) => {
  if (isAbortError(error)) return
  console.error(error)
})

process.on('uncaughtException', (error) => {
  if (isAbortError(error)) return
  console.error(error)
  // An uncaught exception leaves the main process in an unknown state
  // (passthrough, streams, child handles) — running on is worse than quitting,
  // and will-quit below still disposes the whisper server and exam Chrome.
  app.quit()
})
import { electronApp, optimizer } from '@electron-toolkit/utils'
import './shortcuts'
import './streaming'
import './transcription'
import './permissions'
import { createWindow } from './main-window'
import { initAutoUpdater } from './auto-updater'
import { applyDockVisibility, loadEncryptedSecrets, settings } from './settings'
import { disposeWhisperServer } from './whisper-server'
import { adoptRunningExamChrome, shutdownExamChrome } from './chrome-fullpage'

// Hermetic runs (smoke, CDP harness): point userData at a throwaway dir via
// env before anything reads it — keeps the real profile and the login keychain
// (safe storage) out of automated packaged-app verification.
const userDataOverride = process.env.OPEN_INTERVIEW_USER_DATA_DIR
if (userDataOverride) app.setPath('userData', userDataOverride)

// Enable Chromium's native system-audio loopback for getDisplayMedia on macOS
// (ScreenCaptureKit path). Without these hidden flags Electron only supports
// `audio: 'loopback'` on Windows; with them the same no-driver loopback the
// Windows path uses works on macOS 13.2+. Must be appended before the app is
// ready. Unknown features are ignored on other platforms.
app.commandLine.appendSwitch(
  'enable-features',
  'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride'
)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows — must match electron-builder's appId
  // or notifications and taskbar grouping break on Windows
  electronApp.setAppUserModelId('com.heyseere.open-interview')

  // Apply the persisted-default dock posture up front (privacy mode is off
  // by default, so the dock usually shows). The real `privacyMode` preference
  // lives in the renderer; its sync re-applies privacy (dock + capture
  // protection) shortly after the window mounts.
  applyDockVisibility(settings.privacyMode)

  // Load API keys persisted via safeStorage (idempotent, requires app ready)
  void loadEncryptedSecrets()

  // Auto-approve getDisplayMedia for system audio loopback capture
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    // The callback MUST run exactly once or getDisplayMedia hangs in the
    // renderer forever — cover the no-screen and failed-lookup paths too.
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        if (sources.length > 0) callback({ video: sources[0], audio: 'loopback' })
        else callback({})
      })
      .catch(() => callback({}))
  })

  // Auto-approve mic access so users can enumerate and select audio input
  // devices. 'media' is the type Electron reports for getUserMedia (audio
  // AND video — the constraints are not visible here), and our renderer only
  // ever requests audio; every other permission falls through to the denial
  // below, so the camera is not actually reachable. 'display-capture' is the
  // type Electron reports for getDisplayMedia screen capture (newer majors
  // split it out of 'media') — required for the system-audio loopback path.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (['media', 'microphone', 'audio', 'display-capture'].includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Same allowlist for the synchronous check path (enumerateDevices and
  // similar APIs consult this without firing a request-handler callback).
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    ['media', 'microphone', 'audio', 'display-capture'].includes(permission)
  )

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Configure auto-updater
  initAutoUpdater()

  // Resume browser mode if a dedicated exam Chrome from a previous session
  // is still alive (also pushes the initial exam-chrome-state to the renderer)
  void adoptRunningExamChrome()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (global.mainWindow && !global.mainWindow.isVisible()) {
      global.mainWindow.show()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Unregister all shortcuts when there is no window left
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Stop local ASR (the resident whisper-server + setup jobs) and the dedicated
// exam Chrome so no child process outlives the app.
app.on('will-quit', () => {
  disposeWhisperServer()
  shutdownExamChrome()
})
