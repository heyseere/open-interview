import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import CoderPage from '@/coder'

// Route-level code splitting: settings/help pages are loaded on demand,
// keeping the initial coder-page bundle small.
const SettingsPage = lazy(() => import('@/settings'))
const HelpPage = lazy(() => import('@/help'))
const PermissionsPage = lazy(() => import('@/permissions'))
import { useSettingsStore } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { getCloneableFields } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { isMouseButtonBinding, getMouseButtonAccelerator } from '@/lib/utils/keyboard'

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const settingsStore = useSettingsStore()
  const { shortcuts } = useShortcutsStore()
  const { t } = useI18n()

  useEffect(() => {
    window.api.getAppSettings().then((settings) => {
      const blankFields = Object.keys(settings).filter(
        (key) => settings[key] && !settingsStore[key]
      )
      settingsStore.syncSettings(
        blankFields.reduce(
          (acc, key) => {
            acc[key] = settings[key]
            return acc
          },
          {} as Partial<typeof settingsStore>
        )
      )
      setInitialized(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialized) {
      window.api.updateAppSettings(getCloneableFields(settingsStore))
    }
  }, [initialized, settingsStore])

  useEffect(() => {
    // The main process unregisters everything first, so re-invoking is safe.
    // `shortcuts` is intentionally not a dependency: edits go through the
    // dedicated updateShortcuts IPC. Mouse side-button bindings are handled
    // by the renderer (see below) and must not reach Electron's
    // globalShortcut registration.
    window.api.initShortcuts({
      shortcuts: Object.fromEntries(
        Object.entries(shortcuts).filter(([, shortcut]) => !isMouseButtonBinding(shortcut.key))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Window-local mouse side-button shortcuts: dispatch the bound action while
  // the pointer is over the app window (the always-on-top HUD makes this the
  // common case). OS-global hooks would need native event taps + accessibility
  // permission — out of scope for a dependency-free Electron renderer.
  useEffect(() => {
    const bindings = new Map<string, string>()
    for (const shortcut of Object.values(shortcuts)) {
      if (isMouseButtonBinding(shortcut.key) && !bindings.has(shortcut.key)) {
        bindings.set(shortcut.key, shortcut.action)
      }
    }
    if (bindings.size === 0) return

    const handler = (event: MouseEvent) => {
      const token = getMouseButtonAccelerator(event.button)
      if (!token) return
      const action = bindings.get(token)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      void window.api.triggerAction(action as Parameters<typeof window.api.triggerAction>[0])
    }
    window.addEventListener('mousedown', handler, true)
    return () => window.removeEventListener('mousedown', handler, true)
  }, [shortcuts])

  return (
    <>
      <HashRouter>
        <Suspense
          fallback={
            <div className="h-screen flex items-center justify-center text-sm text-gray-400">
              {t('common.loading')}
            </div>
          }
        >
          <Routes>
            <Route index element={<CoderPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="permissions" element={<PermissionsPage />} />
          </Routes>
        </Suspense>
      </HashRouter>

      <Toaster />
    </>
  )
}
