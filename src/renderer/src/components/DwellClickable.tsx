import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DwellTimer } from '@/lib/utils/dwell-timer'

/** Cooldown after any trigger so dwell and click cannot double-fire. */
const TRIGGER_COOLDOWN_MS = 400

interface DwellClickableProps {
  /** Dwell duration in ms; <= 0 makes this a plain click-only button. */
  durationMs: number
  onTrigger: () => void
  className?: string
  title?: string
  disabled?: boolean
  children: ReactNode
}

/**
 * Button that fires on a configurable hover dwell (with a progress fill) and
 * also responds to plain clicks. Shared by the hover toolbar and dialog
 * actions so every interactive element follows the same no-click workflow.
 */
export function DwellClickable({
  durationMs,
  onTrigger,
  className,
  title,
  disabled,
  children
}: DwellClickableProps) {
  const [progress, setProgress] = useState(0)
  const lastFireRef = useRef(0)
  const timerRef = useRef<DwellTimer | null>(null)

  const fire = () => {
    lastFireRef.current = Date.now()
    setProgress(0)
    onTrigger()
  }

  const beginDwell = () => {
    if (disabled || durationMs <= 0) return
    if (Date.now() - lastFireRef.current < TRIGGER_COOLDOWN_MS) return
    timerRef.current?.cancel()
    timerRef.current = new DwellTimer({
      durationMs,
      onProgress: setProgress,
      onFire: fire
    })
    timerRef.current.begin()
  }

  const cancelDwell = () => {
    timerRef.current?.cancel()
    setProgress(0)
  }

  useEffect(() => () => timerRef.current?.dispose(), [])

  return (
    <button
      className={`relative cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className ?? ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseEnter={beginDwell}
      onMouseLeave={cancelDwell}
      onClick={fire}
    >
      <span className="relative z-10 flex items-center justify-center">{children}</span>
      {progress > 0 && (
        <>
          <span className="absolute inset-0 rounded-[inherit] bg-blue-400/20" />
          <span
            className="absolute inset-x-1.5 bottom-0.5 h-0.5 origin-left rounded bg-blue-400"
            style={{ transform: `scaleX(${progress})` }}
          />
        </>
      )}
    </button>
  )
}
