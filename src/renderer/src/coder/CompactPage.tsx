import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2 } from 'lucide-react'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSettingsStore, COMPACT_MIN_SIZE, type WindowSize } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import { ICON_DIM_SOFT } from '@/lib/icon-state'
import { PANEL } from '@/lib/glass'
import { DwellIconButton } from '@/components/DwellIconButton'
import { ScrollRail } from '@/components/ScrollRail'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { markdownToPlainTextCached } from '@/lib/utils/markdown-text'
import { TickerText } from './TickerText'
import { StatusBar } from './StatusBar'
import { useKeepTopScroll } from './use-keep-top-scroll'

const RESIZE_THROTTLE_MS = 33

interface DragState {
  pointerId: number
  startX: number
  startY: number
  size: number
}

/**
 * The single compact layout: one square panel that shows the answer in full
 * (so code reads naturally) plus a live transcription tail line. Content is
 * limited to the answer, an error row (when present), a return button, a
 * right-edge scroll rail and a bottom-right resize grip; everything else
 * stays on global shortcuts.
 *
 * Same answer/toolbar relationship as the standard layout: the answer
 * scrollport runs to the bottom of the panel and the toolbar pill floats OVER
 * the text (its own bottom padding clears the pill), while the transcript
 * ticker is the thin strip the pill sits above — mirror of the standard
 * ShortcutHints strip.
 */
export function CompactPage() {
  const { t } = useI18n()
  const isLoading = useSolutionStore((state) => state.isLoading)
  const solutionChunks = useSolutionStore((state) => state.solutionChunks)
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  const transcriptionText = useTranscriptionStore((state) => state.transcriptionText)
  const partialText = useTranscriptionStore((state) => state.partialText)
  const compactSize = useSettingsStore((state) => state.compactSize)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const dwell = useDwellMs()

  // Cached per block: streaming appends only re-convert the growing tail.
  const plainText = useMemo(
    () => markdownToPlainTextCached(solutionChunks.join('')),
    [solutionChunks]
  )
  const { ref: bodyRef } = useKeepTopScroll<HTMLDivElement>(plainText.length === 0)
  // Committed + in-flight tail: the ticker should show words the moment they
  // are recognized, not only after a segment is finalized.
  const transcriptTail = useMemo(
    () => (isTranscribing ? `${transcriptionText}${partialText}`.slice(-80) : ''),
    [isTranscribing, transcriptionText, partialText]
  )

  const dragRef = useRef<DragState | null>(null)
  const lastSentRef = useRef(0)
  const latestSizeRef = useRef<WindowSize>({ ...compactSize })

  // Passthrough: the panel body stays click-through (the point of the mode),
  // but the back button and the resize grip lift the window on hover so they
  // remain reachable, like the toolbar and the header icons.
  const backLift = usePassthroughLift()
  const gripLift = usePassthroughLift()

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      latestSizeRef.current = { ...compactSize }
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        size: compactSize.width
      }
    },
    [compactSize]
  )

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    // The panel stays square: the larger axis delta drives the size.
    const delta = Math.max(e.clientX - drag.startX, e.clientY - drag.startY)
    const size = Math.max(COMPACT_MIN_SIZE.width, drag.size + delta)
    latestSizeRef.current = { width: size, height: size }

    const now = performance.now()
    if (now - lastSentRef.current < RESIZE_THROTTLE_MS) return
    lastSentRef.current = now
    void window.api.setWindowSize(size, size)
  }, [])

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
      // Send once more so the persisted size matches what is on screen
      void window.api.setWindowSize(latestSizeRef.current.width, latestSizeRef.current.height)
      updateSetting('compactSize', { ...latestSizeRef.current })
    },
    [updateSetting]
  )

  return (
    <div
      className="relative h-screen flex items-stretch px-3 pb-2 pt-2"
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}
    >
      <div
        className={`relative flex-1 min-w-0 ${PANEL} rounded-xl pl-4 pr-11 pt-2.5 pb-2 select-none flex flex-col`}
      >
        {/* Same dwell button as every other icon surface: hovering it for the
            configured dwell returns to the standard layout, so the compact
            panel needs no click at all. */}
        <DwellIconButton
          ref={backLift.ref}
          durationMs={dwell()}
          title={t('compact.exitStandard')}
          icon={Maximize2}
          size="sm"
          className="absolute top-1.5 right-1.5"
          onTrigger={() => updateSetting('uiLayout', 'standard')}
        />

        <StatusBar compact />

        <div
          ref={bodyRef}
          id="compact-answer"
          className="scroll-quiet mt-1.5 flex-1 min-h-0 overflow-y-auto pb-28 text-white leading-snug whitespace-pre-wrap break-words"
          style={{ fontSize: 'var(--oi-answer-font, 0.875rem)' }}
        >
          {plainText || (!isLoading ? t('compact.waiting') : '')}
        </div>
        {transcriptTail && (
          <TickerText
            text={transcriptTail}
            className="mt-1 text-good-soft text-xs leading-snug shrink-0"
          />
        )}

        <ScrollRail compact containerId="compact-answer" />
      </div>

      {/* Resize grip: anchored to the WINDOW corner, not the panel corner.
          The pill now floats at bottom-9 with the transcript strip under it,
          so the panel's bottom edge is live chrome at every size — the 12px
          window margin keeps the grip clear of pill, strip and rail alike. */}
      <div
        ref={gripLift.ref}
        className={`absolute right-0.5 bottom-0.5 size-3.5 cursor-nwse-resize flex items-end justify-end ${ICON_DIM_SOFT}`}
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title={`${compactSize.width}×${compactSize.height}`}
      >
        <svg viewBox="0 0 10 10" className="size-3">
          <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </div>
    </div>
  )
}
