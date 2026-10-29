import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSettingsStore, STANDARD_WINDOW_SIZE, sceneDisplayName } from '@/lib/store/settings'
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
import { ShortcutHints } from './ShortcutHints'
import { StatusBar } from './StatusBar'
import { CompactPage } from './CompactPage'
import { HoverToolbar } from './HoverToolbar'
import { ScrollRail } from '@/components/ScrollRail'
import { FollowUpDialog } from './FollowUpDialog'
import { ShortcutTip } from './ShortcutTip'
import { useFollowUpStore } from '@/lib/store/follow-up'
import { CANVAS, CANVAS_ID } from '@/lib/glass'

/** Opacity step per shortcut press; matches the settings slider grid (0.1–1). */
const OPACITY_STEP = 0.1

export default function CoderPage() {
  const opacity = useSettingsStore((state) => state.opacity)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const language = useSettingsStore((state) => state.language)
  const syncAppState = useAppStore((state) => state.syncAppState)
  // Action references are stable in zustand; subscribing to the whole store
  // would re-render the page (and every child) on each transcription/chunk
  // update — that is the entire streaming hot path.
  const setIsTranscribing = useTranscriptionStore((state) => state.setIsTranscribing)
  const setTranscriptionText = useTranscriptionStore((state) => state.setTranscriptionText)
  const clearText = useTranscriptionStore((state) => state.clearText)
  const setPartialText = useTranscriptionStore((state) => state.setPartialText)
  const setErrorMessage = useSolutionStore((state) => state.setErrorMessage)
  const screenshotData = useSolutionStore((state) => state.screenshotData)
  // One window, two layouts: standard ↔ compact
  const prevLayoutRef = useRef(uiLayout)

  useEffect(() => {
    // Adopt main's authoritative state before anything reads it: passthrough
    // survives renderer reloads while the zustand store resets, so a reload
    // must re-sync or the window stays click-through with no lift armed.
    window.api
      .updateAppState({ inCoderPage: true })
      .then(() => window.api.getAppState())
      .then(syncAppState)
      .catch(() => {})
    return () => {
      window.api.updateAppState({ inCoderPage: false })
    }
  }, [syncAppState])

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

  // Global shortcut → cycle the prompt scene (the header dropdown mirrors it)
  useEffect(() => {
    window.api.onCyclePromptScene(() => {
      const state = useSettingsStore.getState()
      if (state.scenes.length === 0) return
      const index = state.scenes.findIndex((scene) => scene.id === state.activeSceneId)
      const next = state.scenes[(index + 1) % state.scenes.length]
      state.setActiveScene(next.id)
      toast.info(
        translate(language, 'toast.sceneSwitched', {
          name: sceneDisplayName(next, (key) => translate(language, key))
        })
      )
    })
    return () => {
      window.api.removeCyclePromptSceneListener()
    }
  }, [language])

  // Global shortcut → step the window opacity (Cmd+[ / Cmd+])
  useEffect(() => {
    window.api.onAdjustOpacity((delta) => {
      const state = useSettingsStore.getState()
      const next =
        Math.round(Math.min(1, Math.max(0.1, state.opacity + delta * OPACITY_STEP)) * 100) / 100
      if (next === state.opacity) return
      state.updateSetting('opacity', next)
      toast.info(translate(language, 'toast.opacityChanged', { value: Math.round(next * 100) }), {
        id: 'opacity'
      })
    })
    return () => {
      window.api.removeAdjustOpacityListener()
    }
  }, [language])

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

  // Info notices from the main process (e.g. full-page capture truncation).
  // The message is already localized main-side via tMain.
  useEffect(() => {
    window.api.onUiNotify((message) => {
      if (message) toast.info(message)
    })
    return () => {
      window.api.removeUiNotifyListener()
    }
  }, [])

  useEffect(() => {
    window.api.onTranscriptionText((data) => {
      setTranscriptionText(data.text)
    })
    window.api.onTranscriptionError(({ message, fatal, action }) => {
      setErrorMessage(message, action)
      if (fatal) {
        setIsTranscribing(false)
        stopAudioCapture()
      }
    })
    window.api.onTranscriptionStopped(() => {
      setIsTranscribing(false)
      setPartialText('')
    })
    window.api.onTranscriptionCleared(() => {
      clearText()
      setPartialText('')
    })
    window.api.onTranscriptionPartial(({ text }) => {
      setPartialText(text)
    })

    return () => {
      window.api.removeTranscriptionTextListener()
      window.api.removeTranscriptionErrorListener()
      window.api.removeTranscriptionStoppedListener()
      window.api.removeTranscriptionClearedListener()
      window.api.removeTranscriptionPartialListener()
    }
  }, [setTranscriptionText, setIsTranscribing, clearText, setPartialText, setErrorMessage])

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
      <div id={CANVAS_ID} className={`relative h-screen ${CANVAS}`} style={{ opacity }}>
        <CompactPage />
        {/* The toolbar works in compact layout too (it is the only mouse
            surface there); the compact panel reserves its band at the bottom */}
        <HoverToolbar />
        {followUpDialog}
      </div>
    )
  }

  return (
    <div id={CANVAS_ID} className={`relative h-screen ${CANVAS}`} style={{ opacity }}>
      {/* Faded layer: the opacity rides on the CANVAS root (not on an inner
          column) so the frosted sheet and its backdrop blur fade together —
          that is what makes compact mode read as "more see-through" and the
          standard layout must match it. Flex column so the status bar takes
          part in the layout instead of overlaying (and covering) the
          screenshot preview. */}
      <div className="flex h-full flex-col">
        <AppHeader />
        <StatusBar />
        <AppContent />
        <ShortcutHints />
        <HoverToolbar />
        <ScrollRail />
      </div>
      {/* Shortcut tip: inside the faded root, so it inherits the window
          opacity like every other layer (it used to fade itself one step
          deeper, which only worked while the canvas stayed fully opaque) */}
      {!screenshotData && <ShortcutTip />}
      {followUpDialog}
    </div>
  )
}
