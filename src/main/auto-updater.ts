import { dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { tMain } from './i18n'

export function initAutoUpdater(): void {
  if (process.platform === 'darwin') {
    return
  }

  try {
    autoUpdater.autoDownload = false

    autoUpdater.on('update-available', async () => {
      const result = await dialog.showMessageBox({
        type: 'info',
        buttons: [tMain('update.downloadNow'), tMain('update.later')],
        defaultId: 0,
        cancelId: 1,
        title: tMain('update.availableTitle'),
        message: tMain('update.availableMessage'),
        detail: tMain('update.availableDetail')
      })
      if (result.response === 0) {
        autoUpdater.downloadUpdate().catch((err) => console.error(err))
      }
    })

    autoUpdater.on('error', (error) => {
      console.error('Auto update error:', error)
    })

    autoUpdater.on('update-not-available', () => {
      // no-op
    })

    autoUpdater.on('update-downloaded', async () => {
      const res = await dialog.showMessageBox({
        type: 'info',
        buttons: [tMain('update.restartNow'), tMain('update.later')],
        defaultId: 0,
        cancelId: 1,
        title: tMain('update.readyTitle'),
        message: tMain('update.readyMessage'),
        detail: tMain('update.readyDetail')
      })
      if (res.response === 0) {
        setImmediate(() => autoUpdater.quitAndInstall(false, true))
      }
    })

    // Trigger the check after window creation
    autoUpdater.checkForUpdates().catch((err) => console.error(err))
  } catch (e) {
    console.error('Failed to initialize auto-updater:', e)
  }
}
