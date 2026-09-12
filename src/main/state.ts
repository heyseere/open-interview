import { ipcMain } from 'electron'

ipcMain.handle('updateAppState', (_event, _state) => {
  const ignoreChanged =
    !!_state &&
    typeof _state === 'object' &&
    'ignoreMouse' in _state &&
    _state.ignoreMouse !== state.ignoreMouse
  Object.assign(state, _state)
  if (ignoreChanged) {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      // forward:true keeps delivering synthetic mousemove events to the page so
      // the renderer can detect when the pointer enters the toolbar area and
      // temporarily lift passthrough for real clicks / hover-dwell triggers.
      mainWindow.setIgnoreMouseEvents(state.ignoreMouse, { forward: true })
      mainWindow.webContents.send('sync-app-state', state)
    }
  }
})

export const state = {
  inCoderPage: false,
  ignoreMouse: false
}

export type AppState = typeof state
