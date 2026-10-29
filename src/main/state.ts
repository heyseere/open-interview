import { ipcMain } from 'electron'
import { applyAppStatePatch, togglePassthroughState, type AppState } from './app-state'

/**
 * Shared main-process app state. `passthrough` is the user's intent,
 * `ignoreMouse` the value actually applied to the window — see app-state.ts
 * for why the two must stay separate.
 */
export const state: AppState = {
  inCoderPage: false,
  passthrough: false,
  ignoreMouse: false
}

export type { AppState }

/** Push the effective value to the window and echo the state to the renderer. */
function applyIgnoreMouse(): void {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  // forward:true keeps delivering synthetic mousemove events to the page so
  // the renderer can detect when the pointer enters the toolbar area and
  // temporarily lift passthrough for real clicks / hover-dwell triggers.
  mainWindow.setIgnoreMouseEvents(state.ignoreMouse, { forward: true })
  mainWindow.webContents.send('sync-app-state', state)
}

/**
 * Flip passthrough intent. Single implementation behind both the header
 * button and the Alt+M shortcut, so they can never disagree.
 */
export function togglePassthrough(): AppState {
  togglePassthroughState(state)
  applyIgnoreMouse()
  return state
}

ipcMain.handle('updateAppState', (_event, patch: unknown) => {
  // Whitelisted copy instead of Object.assign: unknown keys (or a JSON
  // `__proto__`) must never land on the shared state singleton.
  const changed = applyAppStatePatch(state, patch)
  if (changed) applyIgnoreMouse()
})

/**
 * Authoritative state pull. The renderer store resets on every reload while
 * the main-process state survives — without this pull a reload leaves main
 * click-through while the renderer believes passthrough is off and refuses
 * to lift, and the window becomes unreachable except via Alt+M.
 */
ipcMain.handle('getAppState', () => state)

/** Renderer-facing toggle: the header button sends no value, so a stale
 * render closure can never re-arm passthrough by accident. */
ipcMain.handle('toggle-passthrough', () => togglePassthrough())
