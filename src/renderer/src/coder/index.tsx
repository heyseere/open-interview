import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSettingsStore, STANDARD_WINDOW_SIZE } from '@/lib/store/settings'
import { useAppStore } from '@/lib/store/app'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSolutionStore } from '@/lib/store/solution'
import { stopAudioCapture, disableVAD } from '@/lib/audio-capture'
import { toggleTranscription } from '@/lib/transcription-control'
import {
  cancelTranscription as cancelTranscriptionAction,
  submitTranscriptionNow
} from '@/lib/transcription-control'
import { translate } from '@/lib/i18n'
import { getShortcutAcceleratorDisplay } from '@/lib/utils/keyboard'
import { useShortcutsStore } from '@/lib/store/shortcuts'

import { AppHeader } from './AppHeader'
import { AppContent } from './AppContent'
import { AppStatusBar } from './AppStatusBar'
import { TranscriptionBar } from './TranscriptionBar'
import { CompactPage } from './CompactPage'
import { HoverToolbar } from './HoverToolbar'
import { FollowUpDialog } from './FollowUpDialog'
import { ShortcutTip } from './ShortcutTip'
import { useFollowUpStore } from '@/lib/store/follow-up'

export default function CoderPage() {
  const opacity = useSettingsStore((state) => state.opacity)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const language = useSettingsStore((state) => state.language)
  const { syncAppState } = useAppStore()
  const { setIsTranscribing, setTranscriptionText, clearText, setProgress } =
    useTranscriptionStore()
  const { setErrorMessage, screenshotData } = useSolutionStore()
  // One window, two layouts: standard ↔ compact
  const prevLayoutRef = useRef(uiLayout)

  useEffect(() => {
    window.api.updateAppState({ inCoderPage: true })
    return () => {
      window.api.updateAppState({ inCoderPage: false })
    }
  }, [])

  useEffect(() => {
    window.api.onSyncAppState((state) => {
      syncAppState(state)
    })
    return () => {
      window.api.removeSyncAppStateListener()
    }
  }, [syncAppState])

  // Global shortcut → shared toggle (also used by header mic / hover toolbar / VAD)
  useEffect(() => {
    window.api.onToggleTranscription(() => {
      void toggleTranscription()
    })
    // Hover toolbar → stop transcription discarding the transcript
    window.api.onCancelTranscription(() => {
      void cancelTranscriptionAction()
    })
    // Hover toolbar → stop transcription and submit the transcript right away
    window.api.onSubmitTranscription(() => {
      void submitTranscriptionNow()
    })
    return () => {
      disableVAD()
      window.api.removeToggleTranscriptionListener()
      window.api.removeCancelTranscriptionListener()
      window.api.removeSubmitTranscriptionListener()
    }
  }, [])

  // Global shortcut → flip between the standard layout and the compact panel
  useEffect(() => {
    window.api.onToggleMiniMode(() => {
      const state = useSettingsStore.getState()
      state.updateSetting('uiLayout', state.uiLayout === 'compact' ? 'standard' : 'compact')
    })
    return () => {
      window.api.removeToggleMiniModeListener()
    }
  }, [])

  // Global shortcut → open the shared follow-up dialog
  useEffect(() => {
    window.api.onOpenFollowUp(() => {
      useFollowUpStore.getState().open()
    })
    return () => {
      window.api.removeOpenFollowUpListener()
    }
  }, [])

  // Apply the window size of the layout that was just entered. The compact
  // panel is a single square, so only the layout switch reshapes the window.
  useEffect(() => {
    const changed = prevLayoutRef.current !== uiLayout
    if (!changed) return
    prevLayoutRef.current = uiLayout
    const state = useSettingsStore.getState()
    if (uiLayout !== 'compact') {
      void window.api.setWindowSize(STANDARD_WINDOW_SIZE.width, STANDARD_WINDOW_SIZE.height)
      return
    }
    void window.api.setWindowSize(state.compactSize.width, state.compactSize.height)
    const key = getShortcutAcceleratorDisplay(
      useShortcutsStore.getState().shortcuts.toggleMiniMode.key
    )
    toast.info(translate(language, 'toast.compactModeEntered', { key }))
  }, [uiLayout, language])

  useEffect(() => {
    window.api.onTranscriptionText((data) => {
      setTranscriptionText(data.text)
    })
    window.api.onTranscriptionError(({ message, fatal }) => {
      setErrorMessage(message)
      if (fatal) {
        setIsTranscribing(false)
        stopAudioCapture()
      }
    })
    window.api.onTranscriptionStopped(() => {
      setIsTranscribing(false)
      setProgress(null)
    })
    window.api.onTranscriptionCleared(() => {
      clearText()
      setProgress(null)
    })
    window.api.onTranscriptionProgress((progress) => {
      setProgress(progress)
    })

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionErrorListener()
      window.api.removeTranscriptionStoppedListener()
      window.api.removeTranscriptionClearedListener()
      window.api.removeTranscriptionProgressListener()
    }
  }, [setTranscriptionText, setIsTranscribing, clearText, setProgress, setErrorMessage])

  useEffect(() => {
    return () => {
      if (useTranscriptionStore.getState().isTranscribing) {
        stopAudioCapture()
        void window.api.stopTranscription()
        void window.api.clearTranscriptionText().catch(() => undefined)
        // Reset the store too: the `transcription-stopped` event arrives after
        // these listeners are gone, and a stale `isTranscribing` would make
        // the next mic press submit the old transcript instead of recording
        useTranscriptionStore.getState().resetState()
      }
    }
  }, [])

  const isFollowUpOpen = useFollowUpStore((state) => state.isOpen)
  const setFollowUpOpen = useFollowUpStore((state) => state.setOpen)
  const followUpDialog = <FollowUpDialog open={isFollowUpOpen} onOpenChange={setFollowUpOpen} />

  if (uiLayout === 'compact') {
    return (
      <div className="relative h-screen" style={{ opacity }}>
        <CompactPage />
        {followUpDialog}
      </div>
    )
  }

  return (
    <div className="relative h-screen">
      {/* Faded layer: regular content follows the window opacity setting */}
      <div style={{ opacity }}>
        <AppHeader />
        <AppContent />
        <TranscriptionBar />
        <AppStatusBar />
        <HoverToolbar />
      </div>
      {/* Crisp layer: the shortcut tip fades with its own opacity — synced to
          the window setting but one step deeper (see ShortcutTip) — so it
          stays distinguishable without ignoring the transparency preference */}
      {!screenshotData && <ShortcutTip />}
      {followUpDialog}
    </div>
  )
}
