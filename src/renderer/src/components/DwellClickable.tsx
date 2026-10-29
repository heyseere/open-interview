import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'
import { DwellTimer } from '@/lib/utils/dwell-timer'

/** Cooldown after any trigger so dwell and click cannot double-fire. */
const TRIGGER_COOLDOWN_MS = 400

interface DwellClickableProps {
  /** Dwell duration in ms; <= 0 makes this a plain click-only button. */
  durationMs: number
  /**
   * `source` says how the action was requested: 'dwell' after the hover timer
   * completed, 'click' for a real press. Callers that need one-shot behaviour
   * on hover but a stepped action on click (the scroll rail) branch on it.
   */
  onTrigger: (source: DwellSource) => void
  /** Pointer left the button (or it unmounted): stop anything dwell started. */
  onHoverEnd?: () => void
  className?: string
  title?: string
  /** Toggle state, forwarded as `aria-pressed` (null = not a toggle). */
  pressed?: boolean
  disabled?: boolean
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export type DwellSource = 'dwell' | 'click'

/**
 * Button that fires on a configurable hover dwell (with a progress fill) and
 * also responds to plain clicks. Shared by the hover toolbar and dialog
 * actions so every interactive element follows the same no-click workflow.
 *
 * Two rules keep a toggle from firing twice or firing stale state:
 * - `onTrigger` is read through a ref, so the timer created at mouseenter
 *   calls the LATEST render's handler. The passthrough lift re-renders the
 *   header between mouseenter and fire, and a captured closure would still
 *   hold the pre-lift value.
 * - A click arriving inside the cooldown after a dwell fire is ignored. The
 *   cooldown gates starting a dwell, not the click path, so without this a
 *   user who waits out the dwell and then clicks flips the toggle twice.
 */
export function DwellClickable({
  durationMs,
  onTrigger,
  onHoverEnd,
  className,
  title,
  pressed,
  disabled,
  ref,
  children
}: DwellClickableProps) {
  const [progress, setProgress] = useState(0)
  const lastFireRef = useRef(0)
  const timerRef = useRef<DwellTimer | null>(null)
  const triggerRef = useRef(onTrigger)
  triggerRef.current = onTrigger
  // Same reason as onTrigger: the unmount cleanup below is registered once and
  // must reach the latest handler, not the first render's.
  const hoverEndRef = useRef(onHoverEnd)
  hoverEndRef.current = onHoverEnd

  const fire = (source: DwellSource) => {
    // A click must cancel an in-flight dwell: the timer still counting down
    // from mouseenter would otherwise fire on top of the click.
    timerRef.current?.cancel()
    lastFireRef.current = Date.now()
    setProgress(0)
    triggerRef.current(source)
  }

  const beginDwell = () => {
    if (disabled || durationMs <= 0) return
    if (Date.now() - lastFireRef.current < TRIGGER_COOLDOWN_MS) return
    timerRef.current?.cancel()
    timerRef.current = new DwellTimer({
      durationMs,
      onProgress: setProgress,
      onFire: () => fire('dwell')
    })
    timerRef.current.begin()
  }

  const cancelDwell = () => {
    timerRef.current?.cancel()
    setProgress(0)
  }

  const onMouseLeave = () => {
    cancelDwell()
    hoverEndRef.current?.()
  }

  const onClick = () => {
    // Swallow the click that follows a just-fired dwell: the user pressed on
    // a button that had already triggered, not a second command.
    if (Date.now() - lastFireRef.current < TRIGGER_COOLDOWN_MS) return
    fire('click')
  }

  useEffect(
    () => () => {
      timerRef.current?.dispose()
      // Unmounting mid-hover (a layout switch, a dialog closing) must release
      // whatever the dwell started, or a continuous scroll would keep running.
      hoverEndRef.current?.()
    },
    []
  )

  return (
    <button
      type="button"
      ref={ref}
      // `cn` (tailwind-merge) so a caller can replace the base `relative` with
      // `absolute` — the compact back button is positioned inside its panel and
      // a plain template string would emit both classes, leaving it relative.
      // Unavailable styling (pale gray) comes from the caller's className via
      // iconStateClass; here we only make sure a disabled button never reacts.
      className={cn(
        'relative cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        disabled && 'pointer-events-none',
        className
      )}
      // Every dwell button is interactive chrome, so it must opt out of any
      // enclosing window-drag region. The compact layout makes the WHOLE
      // window draggable; a button left inside that region receives hover
      // events but its mousedown is spent starting a window drag — which is
      // exactly why the compact back button only "sometimes" responded. Doing
      // it here covers every current and future dwell button instead of
      // relying on each call site to remember.
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseEnter={beginDwell}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <span className="relative z-10 flex items-center justify-center">{children}</span>
      {progress > 0 && (
        <>
          <span className="absolute inset-0 rounded-[inherit] bg-live/20" />
          <span
            className="absolute inset-x-1.5 bottom-0.5 h-0.5 origin-left rounded bg-live"
            style={{ transform: `scaleX(${progress})` }}
          />
        </>
      )}
    </button>
  )
}
