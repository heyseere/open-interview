import type { BrowserWindow } from 'electron'
import { state } from './state'

/**
 * Small shared helpers for the main process.
 *
 * `emitToRenderer` replaces the per-module copies of "is the window still
 * there? then send"; `coderPageWindow` additionally requires the user to be
 * ON the coder page, so global shortcuts that only make sense there are
 * ignored while the user is in settings/help.
 */

/** Send an IPC event to the main window, if it is still alive. */
export function emitToRenderer(channel: string, ...args: unknown[]): void {
  const mainWindow: BrowserWindow | undefined = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, ...args)
}

/** The main window iff it is alive AND the user is on the coder page. */
export function coderPageWindow(): BrowserWindow | undefined {
  const mainWindow: BrowserWindow | undefined = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed() || !state.inCoderPage) return undefined
  return mainWindow
}

/** User-facing message of an unknown thrown value. */
export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
