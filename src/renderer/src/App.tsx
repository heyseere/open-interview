import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router'
import { Toaster, toast } from 'sonner'
import CoderPage from '@/coder'

// Route-level code splitting: settings/help pages are loaded on demand,
// keeping the initial coder-page bundle small.
const SettingsPage = lazy(() => import('@/settings'))
const HelpPage = lazy(() => import('@/help'))
const PermissionsPage = lazy(() => import('@/permissions'))
import { useShallow } from 'zustand/react/shallow'
import {
  useSettingsStore,
  activeProviderOf,
  ANSWER_FONT_SIZES,
  ANSWER_FONT_DEFAULT
} from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useExamChromeStore } from '@/lib/store/exam-chrome'
import { useSolutionStore } from '@/lib/store/solution'
import { useI18n } from '@/lib/i18n'
import { isMouseButtonBinding, getMouseButtonAccelerator } from '@/lib/utils/keyboard'
import { toAppSettings } from '@/lib/app-settings-payload'

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const shortcuts = useShortcutsStore((state) => state.shortcuts)
  const { t } = useI18n()
  const answerFontSize = useSettingsStore((state) => state.answerFontSize)

  // The answer text size (markdown answer + compact panel) rides on a root
  // CSS variable so every answer surface picks it up without prop drilling
  useEffect(() => {
    const px = ANSWER_FONT_SIZES[answerFontSize] ?? ANSWER_FONT_SIZES[ANSWER_FONT_DEFAULT]
    document.documentElement.style.setProperty('--oi-answer-font', `${px}px`)
  }, [answerFontSize])

  useEffect(() => {
    window.api.getAppSettings().then(async (mainSettings) => {
      // The renderer store (localStorage) is the source of truth for which
      // provider is active; main only remembers what the LAST sync said. Never
      // adopt main's providerId here — after a renderer reload that would
      // revert a provider switch made in another window/session.
      let provider = activeProviderOf(useSettingsStore.getState())
      if (provider) {
        // Only fetch the key for a provider that has no key in memory yet:
        // an empty renderer key means it was never loaded (keys are stripped
        // from localStorage), while a typed-but-unsaved key stays untouched.
        if (!provider.apiKey) {
          const savedKey = await window.api.getProviderApiKey(provider.id).catch(() => '')
          if (savedKey) {
            useSettingsStore.getState().updateProvider(provider.id, { apiKey: savedKey })
          }
        }
        provider = activeProviderOf(useSettingsStore.getState())
      }
      // First run / empty endpoint: seed from main (which reads the .env
      // defaults) so a packaged app can ship preconfigured.
      if (provider && !provider.baseURL && mainSettings.apiBaseURL) {
        useSettingsStore.getState().updateProvider(provider.id, {
          baseURL: mainSettings.apiBaseURL,
          model: mainSettings.model || provider.model
        })
      }
      setInitialized(true)
    })
  }, [])

  // Only the fields main actually reads are subscribed, so typing in an
  // unrelated settings input no longer re-renders the app root or re-sends
  // the whole store over IPC.
  const mainSettings = useSettingsStore(useShallow((state) => toAppSettings(state)))

  useEffect(() => {
    if (!initialized) return
    // reasoningEffort travels exactly as selected: detection is a UI hint, not
    // a gate (see main/reasoning-body.ts).
    void window.api.updateAppSettings(mainSettings)
  }, [initialized, mainSettings])

  useEffect(() => {
    // The main process unregisters everything first, so re-invoking is safe.
    // `shortcuts` is intentionally not a dependency: edits go through the
    // dedicated updateShortcuts IPC. Mouse side-button bindings are handled
    // by the renderer (see below) and must not reach Electron's
    // globalShortcut registration.
    void window.api
      .initShortcuts({
        shortcuts: Object.fromEntries(
          Object.entries(shortcuts).filter(([, shortcut]) => !isMouseButtonBinding(shortcut.key))
        )
      })
      .then((report) => {
        useShortcutsStore.getState().applyRegistration(report)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Window-local mouse side-button shortcuts: dispatch the bound action while
  // the pointer is over the app window (the privacy-mode overlay makes this
  // the common case). OS-global hooks would need native event taps +
  // accessibility permission — out of scope for a dependency-free renderer.
  // Main falls through to the full shortcut action table, so every bindable
  // action works; failures surface as a toast instead of a silent no-op.
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
      void window.api
        .triggerAction(action as Parameters<typeof window.api.triggerAction>[0])
        .then((result) => {
          if (!result.success && result.error) toast.error(result.error)
        })
    }
    window.addEventListener('mousedown', handler, true)
    return () => window.removeEventListener('mousedown', handler, true)
  }, [shortcuts, t])

  // Browser-mode state: seed once, then follow main's exam-chrome-state pushes
  useEffect(() => {
    window.api.getChromeFullPageStatus().then((status) => {
      useExamChromeStore.getState().setExamChrome(status.running, status.port)
    })
    window.api.onExamChromeState(({ running, port }) => {
      useExamChromeStore.getState().setExamChrome(running, port)
    })
    return () => {
      window.api.removeExamChromeStateListener()
    }
  }, [])

  // Visual-verification seed (scripts/shot.mjs): `#/?demo=1` fills the answer
  // surface with sample content instead of calling the AI. No-op otherwise.
  // Dynamically imported so the demo-only chunk stays out of the main bundle.
  useEffect(() => {
    void import('@/lib/demo-seed').then((mod) => mod.maybeSeedDemoContent())
  }, [])

  // Streaming lifecycle events are window-global: subscribe them in this
  // resident component. A coder-route-only subscription loses every event
  // emitted while the user visits settings/help mid-answer — loading spinner
  // stuck, answer text gone.
  useEffect(() => {
    const solution = useSolutionStore.getState()
    // The gallery is the single screenshot payload; the latest capture is its
    // last entry (appendImage pushes to the end). The separate screenshot-taken
    // event used to re-send the same base64 over IPC on every capture.
    window.api.onScreenshotsUpdated((screenshots) => {
      solution.setRecentScreenshots(screenshots)
      solution.setScreenshotData(screenshots.at(-1) ?? null)
    })
    window.api.onSolutionClear(() => {
      solution.clearSolution()
      solution.setRecentScreenshots([])
      solution.setScreenshotData(null)
      solution.setErrorMessage(null)
    })
    window.api.onSolutionChunk((chunk) => {
      solution.addSolutionChunk(chunk)
    })
    window.api.onAiLoadingStart(() => {
      solution.setIsLoading(true)
      solution.setErrorMessage(null) // Clear error when new request starts
    })
    window.api.onAiLoadingEnd(() => {
      solution.setIsLoading(false)
    })
    window.api.onSolutionComplete(() => {
      solution.setIsLoading(false)
    })
    window.api.onSolutionStopped(() => {
      solution.setIsLoading(false)
    })
    window.api.onSolutionError((error) => {
      solution.setIsLoading(false)
      if (error) solution.setErrorMessage(error.message, error.action)
    })
    return () => {
      window.api.removeScreenshotsUpdatedListener()
      window.api.removeSolutionChunkListener()
      window.api.removeAiLoadingStartListener()
      window.api.removeAiLoadingEndListener()
      window.api.removeSolutionCompleteListener()
      window.api.removeSolutionStoppedListener()
      window.api.removeSolutionErrorListener()
      window.api.removeSolutionClearListener()
    }
  }, [])

  return (
    <>
      <HashRouter>
        <Suspense
          fallback={
            <div className="h-screen flex items-center justify-center text-sm text-ink-faint">
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

      <Toaster theme="dark" />
    </>
  )
}
