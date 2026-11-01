import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { CANVAS_ID, GLASS_BORDER, GLASS_CARD } from '@/lib/glass'
import { DwellTimer } from '@/lib/utils/dwell-timer'

/** Cooldown after any trigger so dwell and click cannot double-fire. */
const TRIGGER_COOLDOWN_MS = 400

/* Self-drawn tooltip timing/geometry. The native title needs 1-1.5s of hover
   and loses the race against the default 500ms dwell — the label must be
   readable BEFORE the action fires. The chip never blocks the pointer, so it
   cannot interfere with the dwell itself. */
const TOOLTIP_DELAY_MS = 200
const TOOLTIP_GAP_PX = 6
const TOOLTIP_EDGE_MARGIN_PX = 8
/** A left-aligned chip is assumed at most this wide before flipping to
    right-aligned near the window's right edge (scroll rail). */
const TOOLTIP_MAX_WIDTH_PX = 180

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
  /**
   * Replace the native title attribute with the self-drawn glass tooltip.
   * Icon-only buttons are the problem surface: hovering to READ the label
   * would fire the dwell first. `title` still becomes aria-label, so the
   * accessible name (and the title=aria-label convention) is unchanged —
   * only the hover tooltip changes rendering.
   */
  tooltip?: boolean
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
  tooltip,
  pressed,
  disabled,
  ref,
  children
}: DwellClickableProps) {
  const [progress, setProgress] = useState(0)
  const [tipStyle, setTipStyle] = useState<CSSProperties | null>(null)
  const lastFireRef = useRef(0)
  const timerRef = useRef<DwellTimer | null>(null)
  const tipTimerRef = useRef<number | null>(null)
  const triggerRef = useRef(onTrigger)
  triggerRef.current = onTrigger
  // Same reason as onTrigger: the unmount cleanup below is registered once and
  // must reach the latest handler, not the first render's.
  const hoverEndRef = useRef(onHoverEnd)
  hoverEndRef.current = onHoverEnd
  // The forwarded ref must keep reaching the button (passthrough lift refs);
  // the tooltip needs the same element for its rect.
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const setButtonRef = (el: HTMLButtonElement | null) => {
    buttonRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  const showTipNow = () => {
    tipTimerRef.current = null
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const style: CSSProperties = { position: 'fixed' }
    // Lower half of the window: open upward so the chip stays inside.
    if (rect.top > vh / 2) style.bottom = vh - rect.top + TOOLTIP_GAP_PX
    else style.top = rect.bottom + TOOLTIP_GAP_PX
    // Near the right edge (scroll rail) grow leftward instead of clipping.
    if (rect.right + TOOLTIP_MAX_WIDTH_PX > vw) style.right = vw - rect.right
    else style.left = Math.max(rect.left, TOOLTIP_EDGE_MARGIN_PX)
    setTipStyle(style)
  }

  const hideTip = () => {
    if (tipTimerRef.current !== null) {
      window.clearTimeout(tipTimerRef.current)
      tipTimerRef.current = null
    }
    setTipStyle(null)
  }

  const scheduleTip = () => {
    // Disabled buttons never receive pointer events (pointer-events-none);
    // the guard is belt-and-braces for programmatic enters.
    if (!tooltip || disabled) return
    tipTimerRef.current = window.setTimeout(showTipNow, TOOLTIP_DELAY_MS)
  }

  const fire = (source: DwellSource) => {
    // A click must cancel an in-flight dwell: the timer still counting down
    // from mouseenter would otherwise fire on top of the click.
    timerRef.current?.cancel()
    lastFireRef.current = Date.now()
    setProgress(0)
    hideTip()
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
    hideTip()
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
      if (tipTimerRef.current !== null) window.clearTimeout(tipTimerRef.current)
      // Unmounting mid-hover (a layout switch, a dialog closing) must release
      // whatever the dwell started, or a continuous scroll would keep running.
      hoverEndRef.current?.()
    },
    []
  )

  // The canvas root always exists while a dwell button is mounted (every
  // layout mounts it); without it there is no correct portal target, so no
  // tooltip rather than a broken one on document.body.
  const tipHost = tipStyle ? document.getElementById(CANVAS_ID) : null

  return (
    <>
      <button
        type="button"
        ref={setButtonRef}
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
        // With the self-drawn tooltip the native attribute would double up on
        // hover; aria-label carries the accessible name either way.
        title={tooltip ? undefined : title}
        aria-label={title}
        aria-pressed={pressed}
        disabled={disabled}
        onMouseEnter={() => {
          beginDwell()
          scheduleTip()
        }}
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
      {tipStyle &&
        tipHost &&
        // Portal into the canvas (AGENTS dialog rule) so the chip follows the
        // window fade and really blurs the page. pointer-events-none keeps the
        // passthrough lift surfaces intact — the tooltip must never receive a
        // pointer or the mouse mode would flap while it is visible.
        createPortal(
          <div
            role="tooltip"
            className={cn(
              'pointer-events-none z-[60] whitespace-nowrap rounded-md px-2 py-1 text-xs text-ink',
              GLASS_CARD,
              GLASS_BORDER
            )}
            style={tipStyle}
          >
            {title}
          </div>,
          tipHost
        )}
    </>
  )
}
