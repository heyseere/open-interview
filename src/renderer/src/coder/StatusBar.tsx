import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AlertCircle, Loader2, Mic, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { subscribeCaptureLevel } from '@/lib/audio-capture'
import { useI18n } from '@/lib/i18n'
import { iconStateClass } from '@/lib/icon-state'
import { usePassthroughLift } from '@/lib/passthrough-lift'

/**
 * Status bar (grew out of the transcription-only bar): one bar reporting
 * everything currently in flight — errors, generation, transcription.
 *
 * Standard layout: renders IN FLOW between the header and the answer area
 * (it used to overlay top-10, which covered the screenshot preview) and
 * hides entirely when there is nothing to report. Compact layout: rendered
 * inline at the top of the panel, showing ONLY the error row — generation
 * and transcription state is conveyed by the toolbar buttons and the bottom
 * transcript ticker.
 */

/**
 * Live input-level meter. Subscribes to the per-frame RMS readout from the
 * capture graph and writes the fill width directly to the DOM — the 60fps
 * updates must not go through React's render path.
 */
function CaptureLevelMeter() {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeCaptureLevel((rms) => {
      const el = fillRef.current
      if (!el) return
      // sqrt keeps quiet speech visible; loopback/mic levels peak around 0.5
      el.style.width = `${Math.min(100, Math.round(Math.sqrt(rms) * 220))}%`
    })
  }, [])

  return (
    <div className="mt-1.5 h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-hairline-2">
      <div
        ref={fillRef}
        className="h-full w-0 rounded-full bg-good transition-[width] duration-75"
      />
    </div>
  )
}

/**
 * Shared style for the error row's right-side action pills (retry / open
 * settings / open permission center).
 */
const ERROR_ACTION_CLASS =
  'flex-shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-xs text-bad-soft transition-colors hover:bg-bad/15 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Error row with a kind-aware action + close. The action comes with the
 * error (`errorAction`): an AI failure offers Retry, a permission failure
 * opens the permission center (live status + per-pane System Settings
 * buttons), a configuration failure opens Settings. A lift surface of its
 * own: during passthrough the buttons must stay reachable (standard bar) and
 * clickable over the compact panel's drag region — hover lifts the window,
 * like the toolbar.
 */
function ErrorRow({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const errorMessage = useSolutionStore((state) => state.errorMessage)
  const errorAction = useSolutionStore((state) => state.errorAction)
  const setErrorMessage = useSolutionStore((state) => state.setErrorMessage)
  const [isRetrying, setIsRetrying] = useState(false)
  const lift = usePassthroughLift()

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      const result = await window.api.retrySolutionStream()
      if (!result.success && result.error) setErrorMessage(result.error, 'retry')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div
      ref={lift.ref}
      className={`flex items-center gap-2 rounded-md border border-bad/30 bg-bad/15 ${
        compact ? 'px-1.5 py-1' : 'px-2 py-1'
      }`}
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      <AlertCircle className="size-4 flex-shrink-0 text-bad" />
      <p
        className={`min-w-0 flex-1 truncate text-bad-soft ${compact ? 'text-micro' : 'text-xs'}`}
        title={errorMessage ?? undefined}
      >
        {errorMessage}
      </p>
      {errorAction === 'retry' && (
        <button
          onClick={() => void handleRetry()}
          disabled={isRetrying}
          className={ERROR_ACTION_CLASS}
        >
          {t('common.retry')}
        </button>
      )}
      {errorAction === 'open-permissions' && (
        <button onClick={() => navigate('/permissions')} className={ERROR_ACTION_CLASS}>
          {t('errAction.openPermissions')}
        </button>
      )}
      {errorAction === 'open-settings' && (
        <button onClick={() => navigate('/settings')} className={ERROR_ACTION_CLASS}>
          {t('errAction.openSettings')}
        </button>
      )}
      <button
        onClick={() => setErrorMessage(null)}
        className={`flex-shrink-0 size-6 flex items-center justify-center rounded-full ${iconStateClass(
          { danger: true }
        )}`}
        title={t('common.close')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function GeneratingRow() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="size-4 flex-shrink-0 animate-spin text-live-soft" />
      <span className="text-xs text-ink">{t('status.generating')}</span>
    </div>
  )
}

function TranscriptionRow() {
  const { t } = useI18n()
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  const transcriptionText = useTranscriptionStore((state) => state.transcriptionText)
  const partialText = useTranscriptionStore((state) => state.partialText)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcriptionText, partialText])

  return (
    <div className="flex items-start gap-2">
      {isTranscribing && <Mic className="mt-0.5 size-4 flex-shrink-0 animate-pulse text-good" />}
      <div
        ref={scrollRef}
        className="transcription-scroll max-h-[4.2em] min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-[1.4em] text-ink-soft"
      >
        {transcriptionText}
        {partialText && <span className="text-ink-faint">{partialText}</span>}
        {!transcriptionText && !partialText && isTranscribing && (
          <span>{t('transcription.waitingForSpeech')}</span>
        )}
      </div>
      {isTranscribing && <CaptureLevelMeter />}
    </div>
  )
}

export function StatusBar({ compact = false }: { compact?: boolean }) {
  const isLoading = useSolutionStore((state) => state.isLoading)
  const errorMessage = useSolutionStore((state) => state.errorMessage)
  const isTranscribing = useTranscriptionStore((state) => state.isTranscribing)
  const transcriptionText = useTranscriptionStore((state) => state.transcriptionText)
  const partialText = useTranscriptionStore((state) => state.partialText)

  if (compact) {
    if (!errorMessage) return null
    return (
      <div className="shrink-0">
        <ErrorRow compact />
      </div>
    )
  }

  const showTranscription =
    isTranscribing || transcriptionText.trim().length > 0 || partialText.trim().length > 0
  if (!errorMessage && !isLoading && !showTranscription) return null

  return (
    <div className="shrink-0 px-6 pb-2">
      <div className="flex flex-col gap-1.5 px-1 py-0.5">
        {errorMessage && <ErrorRow />}
        {isLoading && <GeneratingRow />}
        {showTranscription && <TranscriptionRow />}
      </div>
    </div>
  )
}
