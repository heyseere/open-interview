import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  CircleStop,
  Eraser,
  Globe,
  Images,
  MessageCircle,
  Mic,
  RefreshCw,
  Send,
  SquarePen,
  Timer
} from 'lucide-react'
import { useSettingsStore } from '@/lib/store/settings'
import { useExamChromeStore } from '@/lib/store/exam-chrome'
import { useAppStore } from '@/lib/store/app'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useFollowUpStore } from '@/lib/store/follow-up'
import { useI18n } from '@/lib/i18n'
import { disableVAD, enableVAD } from '@/lib/audio-capture'
import { toggleTranscription } from '@/lib/transcription-control'
import { DwellIconButton } from '@/components/DwellIconButton'
import { GLASS_OVERLAY } from '@/lib/glass'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { useWindowSize } from '@/lib/utils/use-window-size'
import {
  TOOLBAR_BUTTON_DEFAULT,
  TOOLBAR_BUTTON_META,
  TOOLBAR_SECTIONS,
  THREE_ROW_WIDTH,
  splitToolbarRows,
  type ToolbarButtonId
} from '@/lib/toolbar-buttons'
import { useHasActiveConversation } from './use-has-active-conversation'

interface ToolbarButtonSpec {
  id: ToolbarButtonId
  icon: LucideIcon
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
 * Floating bottom-center toolbar.
 *
 * Buttons are grouped into three sections (transcription / screenshot /
 * generation). The standard layout always shows every button; the COMPACT
 * layout shows the user's selection (Settings → Appearance → compact toolbar
 * buttons), because there the pill is the only mouse surface and must stay
 * small. As the window narrows the sections split onto two and then three
 * rows (see splitToolbarRows) instead of overflowing the frame — except in
 * compact layout, which caps at two rows so a 2-row pill is guaranteed to
 * fit even the 320px minimum window.
 *
 * The toolbar stays visible during mouse passthrough: the main process uses
 * setIgnoreMouseEvents(true, { forward: true }) so synthetic mousemove events
 * still reach the page, letting us lift passthrough while the pointer hovers
 * the toolbar (clicks + hover-dwell then work normally) and restore it when
 * the pointer leaves.
 */
export function HoverToolbar() {
  const { t } = useI18n()
  // The INTENT, not the effective value: a hover lift writes ignoreMouse false
  // every time the pointer enters this pill, so the dimming would vanish
  // exactly when passthrough is on.
  const passthrough = useAppStore((state) => state.passthrough)
  const toolbarEnabled = useSettingsStore((state) => state.toolbarEnabled)
  const dwell = useDwellMs()
  const toolbarButtons = useSettingsStore((state) => state.toolbarButtons)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const autoSubmitTranscription = useSettingsStore((state) => state.autoSubmitTranscription)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const isLoading = useSolutionStore((state) => state.isLoading)
  const examChromeRunning = useExamChromeStore((state) => state.running)
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  // Boolean selector: the toolbar only cares whether a transcript exists —
  // subscribing to the text itself would rebuild every button on each ASR
  // partial.
  const hasTranscript = useTranscriptionStore((state) => state.transcriptionText.trim().length > 0)
  const openFollowUp = useFollowUpStore((state) => state.open)
  const hasConversation = useHasActiveConversation()
  const { width } = useWindowSize()
  const compact = uiLayout === 'compact'

  // Lift / restore mouse passthrough based on pointer position (see doc
  // above). Shared with the scroll rail so moving between the two overlays
  // never flickers the mouse mode.
  const lift = usePassthroughLift()

  if (!toolbarEnabled) return null

  /** Wipe the displayed answer and replay the most recent request snapshot. */
  const regenerate = () => {
    // clearSolution (not setSolutionChunks) so resetEpoch bumps: a re-answer
    // is a new answer and must scroll back to the top like every other one.
    useSolutionStore.getState().clearSolution()
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

  /** Every renderable button, keyed by id. Visibility is user-configured. */
  const specs: Record<ToolbarButtonId, ToolbarButtonSpec> = {
    voice: {
      id: 'voice',
      icon: Mic,
      label: t('toolbar.voice'),
      active: isTranscribing,
      onTrigger: () => void window.api.triggerAction('toggleTranscription')
    },
    autoSubmit: {
      id: 'autoSubmit',
      icon: Timer,
      label: t('toolbar.autoSubmit'),
      active: autoSubmitTranscription,
      onTrigger: toggleAutoSubmit
    },
    submitTranscript: {
      id: 'submitTranscript',
      icon: Send,
      label: t('toolbar.submitTranscript'),
      disabled: !hasTranscript,
      onTrigger: () => void window.api.triggerAction('submitTranscription')
    },
    clearTranscript: {
      id: 'clearTranscript',
      icon: Eraser,
      label: t('toolbar.clearTranscript'),
      disabled: !hasTranscript && !isTranscribing,
      onTrigger: () => void window.api.triggerAction('cancelTranscription')
    },
    takeScreenshot: {
      id: 'takeScreenshot',
      icon: Camera,
      label: t('toolbar.takeScreenshot'),
      onTrigger: () => void window.api.triggerAction('takeScreenshot')
    },
    fullPageCapture: {
      id: 'fullPageCapture',
      icon: Globe,
      label: t('toolbar.fullPageCapture'),
      disabled: !examChromeRunning,
      onTrigger: () => void window.api.triggerAction('captureFullPage')
    },
    appendScreenshot: {
      id: 'appendScreenshot',
      icon: Images,
      label: t('toolbar.appendScreenshot'),
      disabled: !hasConversation,
      onTrigger: () => void window.api.triggerAction('appendScreenshot')
    },
    followUp: {
      id: 'followUp',
      icon: MessageCircle,
      label: t('toolbar.followUp'),
      disabled: !hasConversation,
      onTrigger: openFollowUp
    },
    stop: {
      id: 'stop',
      icon: CircleStop,
      label: t('toolbar.stop'),
      disabled: !isLoading,
      durationMs: 300,
      onTrigger: () => void window.api.triggerAction('stopSolutionStream')
    },
    retry: {
      id: 'retry',
      icon: RefreshCw,
      label: t('toolbar.retry'),
      disabled: isLoading || !hasConversation,
      onTrigger: regenerate
    },
    newSession: {
      id: 'newSession',
      icon: SquarePen,
      label: t('toolbar.newSession'),
      onTrigger: () => void window.api.triggerAction('newConversation')
    }
  }

  // Standard layout always shows every button; compact shows the user's
  // selection (the settings picker governs compact only).
  const visibleIds = compact ? toolbarButtons : TOOLBAR_BUTTON_DEFAULT

  // Sections in declaration order, filtered to the visible buttons.
  const sections = TOOLBAR_SECTIONS.map((section) => ({
    section,
    buttons: visibleIds
      .filter((id) => TOOLBAR_BUTTON_META[id]?.section === section)
      .map((id) => specs[id])
  })).filter((entry) => entry.buttons.length > 0)

  if (sections.length === 0) return null

  const renderSection = (entry: (typeof sections)[number], showDivider: boolean) => (
    <div key={entry.section} className="flex items-center gap-0.5">
      {showDivider && <span className="mx-1 h-5 w-px bg-hairline-2" aria-hidden />}
      {entry.buttons.map(({ id, icon: Icon, label, disabled, active, durationMs, onTrigger }) => (
        <DwellIconButton
          key={id}
          durationMs={dwell(durationMs)}
          title={label}
          disabled={disabled}
          active={active}
          wash={active}
          icon={Icon}
          onTrigger={onTrigger}
          size="lg"
        />
      ))}
    </div>
  )

  // Narrow windows: transcription keeps its own row and the capture +
  // generation sections share the second one, until the window is narrow
  // enough that every section takes its own row (splitToolbarRows). Compact
  // caps at two rows: the panel reserves one fixed band, and a 2-row pill is
  // guaranteed to fit even the 320px minimum window.
  const rows = splitToolbarRows(sections, compact ? Math.max(width, THREE_ROW_WIDTH) : width)

  return (
    <div
      ref={lift.ref}
      // bottom-9 in BOTH layouts, same relationship as the standard one: the
      // answer scrollport reaches the bottom of the window (its own bottom
      // padding clears the pill) and the pill floats OVER the answer text,
      // which scrolls past behind the glass. The compact panel keeps only a
      // thin transcript strip below the pill.
      className="fixed bottom-9 left-1/2 z-40 -translate-x-1/2"
      // no-drag: in compact layout the whole panel behind the pill is a drag
      // region; an unannotated element painted on top does not opt out, so
      // without this the pill's hover/clicks are eaten by window dragging.
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      <div
        className={`flex flex-col items-center gap-0.5 ${GLASS_OVERLAY} px-1.5 py-1 shadow-card transition-opacity ${
          rows.length > 1 ? 'rounded-2xl' : 'rounded-full'
        } ${passthrough ? 'opacity-60' : 'opacity-100'}`}
      >
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-0.5">
            {row.map((entry, index) => renderSection(entry, index > 0))}
          </div>
        ))}
      </div>
    </div>
  )
}
