import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2 } from 'lucide-react'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { useSettingsStore, COMPACT_MIN_SIZE, type WindowSize } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import { markdownToPlainText } from '@/lib/utils/markdown-text'
import { TickerText } from './TickerText'

const RESIZE_THROTTLE_MS = 33

interface DragState {
  pointerId: number
  startX: number
  startY: number
  size: number
}

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className={`inline-block size-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
  )
}

/**
 * The single compact layout: one square panel that shows the answer in full
 * (so code reads naturally) plus a live transcription tail line. Content is
 * limited to the status row, the answer, a return button and a bottom-right
 * resize grip; everything else stays on global shortcuts.
 */
export function CompactPage() {
  const { t } = useI18n()
  const isLoading = useSolutionStore((state) => state.isLoading)
  const solutionChunks = useSolutionStore((state) => state.solutionChunks)
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  const transcriptionText = useTranscriptionStore((state) => state.transcriptionText)
  const compactSize = useSettingsStore((state) => state.compactSize)
  const updateSetting = useSettingsStore((state) => state.updateSetting)

  const plainText = useMemo(() => markdownToPlainText(solutionChunks.join('')), [solutionChunks])
  const transcriptTail = useMemo(
    () => (isTranscribing ? transcriptionText.slice(-80) : ''),
    [isTranscribing, transcriptionText]
  )

  const dragRef = useRef<DragState | null>(null)
  const lastSentRef = useRef(0)
  const latestSizeRef = useRef<WindowSize>({ ...compactSize })

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

  const statusLabel = isLoading
    ? t('compact.statusGenerating')
    : isTranscribing
      ? t('compact.statusTranscribing')
      : t('compact.statusIdle')

  return (
    <div
      className="h-screen flex items-stretch px-3 py-2"
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}
    >
      <div className="relative flex-1 min-w-0 bg-gray-900/75 backdrop-blur-sm rounded-xl pl-4 pr-10 py-2.5 shadow-lg select-none flex flex-col">
        <button
          title={t('compact.exitStandard')}
          aria-label={t('compact.exitStandard')}
          onClick={() => updateSetting('uiLayout', 'standard')}
          className="absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
          <Maximize2 className="size-3.5" />
        </button>

        <div className="flex items-center gap-2 text-[11px] text-gray-300 shrink-0">
          {isLoading && <StatusDot color="bg-blue-400" pulse />}
          {isTranscribing && <StatusDot color="bg-green-400" pulse />}
          {!isLoading && !isTranscribing && <StatusDot color="bg-gray-500" />}
          <span>{statusLabel}</span>
        </div>

        <div className="mt-1.5 flex-1 min-h-0 overflow-y-auto text-white text-sm leading-snug whitespace-pre-wrap break-words">
          {plainText || (!isLoading ? t('compact.waiting') : '')}
        </div>
        {transcriptTail && (
          <TickerText
            text={transcriptTail}
            className="mt-1 text-green-300/80 text-xs leading-snug shrink-0"
          />
        )}

        <div
          className="absolute right-0.5 bottom-0.5 size-4 cursor-nwse-resize flex items-end justify-end opacity-40 hover:opacity-100 transition-opacity"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title={`${compactSize.width}×${compactSize.height}`}
        >
          <svg viewBox="0 0 10 10" className="size-3 text-gray-300">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </div>
      </div>
    </div>
  )
}
