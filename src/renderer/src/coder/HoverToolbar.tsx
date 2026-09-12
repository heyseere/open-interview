import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Camera,
  CircleStop,
  Eraser,
  Images,
  MessageCircle,
  Mic,
  RefreshCw,
  Send,
  SquarePen,
  Timer
} from 'lucide-react'
import { useAppStore } from '@/lib/store/app'
import { useSettingsStore } from '@/lib/store/settings'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useFollowUpStore } from '@/lib/store/follow-up'
import { useI18n } from '@/lib/i18n'
import { disableVAD, enableVAD } from '@/lib/audio-capture'
import { toggleTranscription } from '@/lib/transcription-control'
import { DwellClickable } from '@/components/DwellClickable'

interface ToolbarButtonSpec {
  id: string
  icon: ComponentType<{ className?: string }>
  label: string
  /** Grayed out when the action cannot fire (missing prerequisites). */
  disabled?: boolean
  /** Lit-up toggle state (transcription / auto-submit switches). */
  active?: boolean
  /** Stop must react faster than the default dwell */
  durationMs?: number
  onTrigger: () => void
}

/**
 * Floating bottom-center toolbar, always visible with three fixed sections
 * (left → right): transcription controls, screenshot controls, generation
 * controls. Buttons that cannot currently fire (no transcript yet, no active
 * conversation, nothing generating) render grayed out instead of appearing
 * and disappearing.
 *
 * The toolbar stays visible during mouse passthrough: the main process uses
 * setIgnoreMouseEvents(true, { forward: true }) so synthetic mousemove events
 * still reach the page, letting us lift passthrough while the pointer hovers
 * the toolbar (clicks + hover-dwell then work normally) and restore it when
 * the pointer leaves.
 */
export function HoverToolbar() {
  const { t } = useI18n()
  const ignoreMouse = useAppStore((state) => state.ignoreMouse)
  const setIgnoreMouse = useAppStore((state) => state.setIgnoreMouse)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const toolbarEnabled = useSettingsStore((state) => state.toolbarEnabled)
  const toolbarDwellMs = useSettingsStore((state) => state.toolbarDwellMs)
  const autoSubmitTranscription = useSettingsStore((state) => state.autoSubmitTranscription)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const isLoading = useSolutionStore((state) => state.isLoading)
  const solutionChunksLength = useSolutionStore((state) => state.solutionChunks.length)
  const screenshotData = useSolutionStore((state) => state.screenshotData)
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  const transcriptionText = useTranscriptionStore((state) => state.transcriptionText)
  const openFollowUp = useFollowUpStore((state) => state.open)
  const [hasConversation, setHasConversation] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  /** Whether passthrough was lifted automatically by hovering the toolbar. */
  const autoLiftedRef = useRef(false)

  // Lift / restore mouse passthrough based on pointer position (see doc above).
  useEffect(() => {
    const isInsideToolbar = (e: MouseEvent): boolean => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return false
      const pad = 8
      return (
        e.clientX >= rect.left - pad &&
        e.clientX <= rect.right + pad &&
        e.clientY >= rect.top - pad &&
        e.clientY <= rect.bottom + pad
      )
    }

    if (ignoreMouse) {
      const onMove = (e: MouseEvent) => {
        if (!isInsideToolbar(e)) return
        autoLiftedRef.current = true
        setIgnoreMouse(false)
        void window.api.updateAppState({ ignoreMouse: false })
      }
      window.addEventListener('mousemove', onMove)
      return () => window.removeEventListener('mousemove', onMove)
    }

    if (!autoLiftedRef.current) return
    // Passthrough was auto-lifted: restore it as soon as the pointer leaves.
    const onMove = (e: MouseEvent) => {
      if (isInsideToolbar(e)) return
      autoLiftedRef.current = false
      setIgnoreMouse(true)
      void window.api.updateAppState({ ignoreMouse: true })
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      // Never leave the window clickable after unmounting mid-hover.
      if (autoLiftedRef.current) {
        autoLiftedRef.current = false
        setIgnoreMouse(true)
        void window.api.updateAppState({ ignoreMouse: true })
      }
    }
  }, [ignoreMouse, setIgnoreMouse])

  useEffect(() => {
    if (isLoading) return
    window.api.hasActiveConversation().then(setHasConversation)
  }, [screenshotData, solutionChunksLength, isLoading])

  if (!toolbarEnabled || uiLayout === 'compact') return null

  const hasTranscript = transcriptionText.trim().length > 0

  /** Wipe the displayed answer and replay the most recent request snapshot. */
  const regenerate = () => {
    const store = useSolutionStore.getState()
    store.setSolutionChunks([])
    store.setErrorMessage(null)
    void window.api.retrySolutionStream()
  }

  /** Flip auto-submit and arm/disarm VAD live while transcription runs. */
  const toggleAutoSubmit = () => {
    const next = !autoSubmitTranscription
    updateSetting('autoSubmitTranscription', next)
    if (isTranscribing) {
      if (next) enableVAD(() => void toggleTranscription())
      else disableVAD()
    }
  }

  const transcriptionControls: ToolbarButtonSpec[] = [
    {
      id: 'voice',
      icon: Mic,
      label: t('toolbar.voice'),
      active: isTranscribing,
      onTrigger: () => void window.api.triggerAction('toggleTranscription')
    },
    {
      id: 'autoSubmit',
      icon: Timer,
      label: t('toolbar.autoSubmit'),
      active: autoSubmitTranscription,
      onTrigger: toggleAutoSubmit
    },
    {
      id: 'submitTranscript',
      icon: Send,
      label: t('toolbar.submitTranscript'),
      disabled: !hasTranscript,
      onTrigger: () => void window.api.triggerAction('submitTranscription')
    },
    {
      id: 'clearTranscript',
      icon: Eraser,
      label: t('toolbar.clearTranscript'),
      disabled: !hasTranscript && !isTranscribing,
      onTrigger: () => void window.api.triggerAction('cancelTranscription')
    }
  ]

  const screenshotControls: ToolbarButtonSpec[] = [
    {
      id: 'takeScreenshot',
      icon: Camera,
      label: t('toolbar.takeScreenshot'),
      onTrigger: () => void window.api.triggerAction('takeScreenshot')
    },
    {
      id: 'appendScreenshot',
      icon: Images,
      label: t('status.appendScreenshot'),
      disabled: !hasConversation,
      onTrigger: () => void window.api.triggerAction('appendScreenshot')
    },
    {
      id: 'followUp',
      icon: MessageCircle,
      label: t('status.followUp'),
      disabled: !hasConversation,
      onTrigger: openFollowUp
    }
  ]

  const generationControls: ToolbarButtonSpec[] = [
    {
      id: 'stop',
      icon: CircleStop,
      label: t('status.stopGenerating'),
      disabled: !isLoading,
      durationMs: Math.min(toolbarDwellMs, 300),
      onTrigger: () => void window.api.triggerAction('stopSolutionStream')
    },
    {
      id: 'retry',
      icon: RefreshCw,
      label: t('toolbar.regenerate'),
      disabled: isLoading || !hasConversation,
      onTrigger: regenerate
    },
    {
      id: 'newSession',
      icon: SquarePen,
      label: t('status.newSession'),
      onTrigger: () => void window.api.triggerAction('newConversation')
    }
  ]

  const sections = [transcriptionControls, screenshotControls, generationControls]

  return (
    <div ref={containerRef} className="fixed bottom-9 left-1/2 -translate-x-1/2 z-40">
      <div
        className={`flex items-center gap-0.5 bg-gray-900/70 backdrop-blur-sm rounded-full px-1.5 py-1 shadow-lg transition-opacity ${
          ignoreMouse ? 'opacity-60' : 'opacity-100'
        }`}
      >
        {sections.map((buttons, index) => (
          <div key={index} className="flex items-center gap-0.5">
            {index > 0 && <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />}
            {buttons.map(({ id, icon: Icon, label, disabled, active, durationMs, onTrigger }) => (
              <DwellClickable
                key={id}
                durationMs={durationMs ?? toolbarDwellMs}
                title={label}
                disabled={disabled}
                className={`size-9 rounded-full text-gray-200 transition-colors ${
                  active ? 'bg-blue-500/40 hover:bg-blue-500/50' : 'hover:bg-white/10'
                }`}
                onTrigger={onTrigger}
              >
                <Icon className="size-4" />
              </DwellClickable>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
