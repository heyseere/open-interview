import { toast } from 'sonner'
import { create } from 'zustand'
import { translate } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/settings'

/**
 * Browser-mode state of the dedicated exam Chrome. Main pushes transitions
 * over `exam-chrome-state` (liveness probe every 3s, launch success, adoption
 * at startup); App.tsx seeds the store with getChromeFullPageStatus on mount.
 * `launch` is the ONE launch flow (header button + help page): guarded,
 * tracks isLaunching, toasts the outcome.
 */
interface ExamChromeStore {
  running: boolean
  port: number | null
  isLaunching: boolean
  setExamChrome: (running: boolean, port: number | null) => void
  launch: () => Promise<void>
}

export const useExamChromeStore = create<ExamChromeStore>()((set, get) => ({
  running: false,
  port: null,
  isLaunching: false,
  setExamChrome: (running, port) => set({ running, port }),
  launch: async () => {
    if (get().running || get().isLaunching) return
    set({ isLaunching: true })
    try {
      const result = await window.api.launchDebugChrome()
      if (result.ok) {
        toast.success(translate(useSettingsStore.getState().language, 'toast.examChromeStarted'))
      } else {
        toast.error(
          result.error || translate(useSettingsStore.getState().language, 'fullPage.captureFailed')
        )
      }
    } finally {
      set({ isLaunching: false })
    }
  }
}))
