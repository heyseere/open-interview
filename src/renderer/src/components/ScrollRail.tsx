import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { GLASS_OVERLAY } from '@/lib/glass'
import { DwellIconButton } from '@/components/DwellIconButton'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { measureScrollState, type ScrollState } from '@/lib/utils/scroll-state'

/**
 * Right-edge page scroller (standard layout: fixed to the window; compact
 * layout: absolutely positioned inside its panel). Coder-only chrome — the
 * settings/help/permissions pages scroll with #app-content's own quiet
 * scrollbar and carry no rail.
 *
 * Four buttons in the same dark glass pill as the bottom hover toolbar:
 * jump to top, page up, page down, jump to bottom. Every button is a
 * DwellClickable, so all four fire on the shared hover dwell (with the same
 * progress fill) and all four still work on click:
 * - top / bottom: one smooth jump to the first or last pixel.
 * - page up / down: a single 0.8-viewport step on click, or a continuous rAF
 *   scroll while the pointer stays on the button after the dwell.
 *
 * The rail only exists while its container actually overflows: a page that
 * fits has nothing to scroll, and a floating pill over empty space reads as
 * broken chrome. Each button also disables (pale gray) at its own end of the
 * range, so a long page still shows which direction remains.
 */

/** Fraction of the viewport moved by one click. */
const PAGE_FRACTION = 0.8
/** Continuous-scroll speed in px/s once the hover dwell completes. */
const HOVER_SCROLL_SPEED = 900
const SCROLL_CONTAINER_ID = 'app-content'
/** Frames to wait for the container to mount before giving up. */
const RESOLVE_RETRY_FRAMES = 30

function defaultGetContainer(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID)
}

/**
 * Resolve the scroll container into state. A layout switch (standard ↔
 * compact) or a route change mounts the container AFTER this component's
 * first render, so resolving once at effect time would leave the rail
 * measuring nothing for its whole lifetime. Bounded rAF retries cover that
 * gap without polling forever.
 */
function useScrollContainer(getContainer: () => HTMLElement | null): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const found = getContainer()
    if (found) {
      setElement(found)
      return
    }
    let frame = 0
    let attempts = 0
    const retry = () => {
      const next = getContainer()
      if (next) {
        setElement(next)
        return
      }
      if (++attempts >= RESOLVE_RETRY_FRAMES) return
      frame = requestAnimationFrame(retry)
    }
    frame = requestAnimationFrame(retry)
    return () => cancelAnimationFrame(frame)
  }, [getContainer])

  return element
}

/** Live overflow + edge state of the target scroll container. */
function useScrollState(element: HTMLElement | null): ScrollState {
  const [state, setState] = useState<ScrollState>({
    scrollable: false,
    atTop: true,
    atBottom: true
  })
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!element) return

    const measure = () => {
      frameRef.current = null
      const next = measureScrollState(element)
      setState((prev) =>
        prev.scrollable === next.scrollable &&
        prev.atTop === next.atTop &&
        prev.atBottom === next.atBottom
          ? prev
          : next
      )
    }
    const refresh = () => {
      if (frameRef.current !== null) return
      frameRef.current = requestAnimationFrame(measure)
    }

    refresh()
    element.addEventListener('scroll', refresh, { passive: true })
    const resizeObserver = new ResizeObserver(refresh)
    resizeObserver.observe(element)
    // Streaming answers change text without resizing the container itself.
    // Mutations arrive per frame; measuring each would force a layout per
    // frame — scroll/resize stay rAF-fast, content changes settle on a short
    // debounce instead.
    let mutationTimer: number | null = null
    const mutationRefresh = () => {
      if (mutationTimer !== null) return
      mutationTimer = window.setTimeout(() => {
        mutationTimer = null
        refresh()
      }, 150)
    }
    const mutationObserver = new MutationObserver(mutationRefresh)
    mutationObserver.observe(element, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', refresh)
    return () => {
      element.removeEventListener('scroll', refresh)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', refresh)
      if (mutationTimer !== null) window.clearTimeout(mutationTimer)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [element])

  return state
}

/** rAF loop scrolling the container at a constant speed. */
function useContinuousScroll(element: HTMLElement | null): {
  start: (direction: -1 | 1) => void
  stop: () => void
} {
  const frameRef = useRef<number | null>(null)
  const lastRef = useRef(0)
  // Read through a ref so the loop survives a re-render without restarting
  // (a restart would reset its frame timing).
  const elementRef = useRef(element)
  elementRef.current = element

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const start = useCallback(
    (direction: -1 | 1) => {
      if (frameRef.current !== null) return
      lastRef.current = performance.now()
      const step = (now: number) => {
        const target = elementRef.current
        if (!target) {
          stop()
          return
        }
        target.scrollTop += ((now - lastRef.current) / 1000) * HOVER_SCROLL_SPEED * direction
        lastRef.current = now
        const atEdge =
          direction < 0
            ? target.scrollTop <= 0
            : target.scrollHeight - target.scrollTop - target.clientHeight <= 0.5
        if (atEdge) {
          stop()
          return
        }
        frameRef.current = requestAnimationFrame(step)
      }
      frameRef.current = requestAnimationFrame(step)
    },
    [stop]
  )

  useEffect(() => stop, [stop])
  return { start, stop }
}

export function ScrollRail({
  containerId,
  compact = false
}: {
  /** Scroll container override (compact panel body); defaults to #app-content. */
  containerId?: string
  compact?: boolean
} = {}) {
  const { t } = useI18n()
  // Identity-stable per containerId, so the resolving effect below does not
  // re-run on unrelated renders.
  const getContainer = useCallback(
    () => (containerId ? document.getElementById(containerId) : defaultGetContainer()),
    [containerId]
  )
  const dwell = useDwellMs()
  const element = useScrollContainer(getContainer)
  const { scrollable, atTop, atBottom } = useScrollState(element)
  const { start, stop } = useContinuousScroll(element)

  // Passthrough lift shares the coordinator with the hover toolbar, so moving
  // between the two overlays never flickers the mouse mode. no-drag (added by
  // DwellClickable) keeps the buttons clickable over the compact drag region.
  const lift = usePassthroughLift()

  /** Page step: one smooth 0.8-viewport move. */
  const jump = (direction: -1 | 1) => {
    if (!element) return
    element.scrollTo({
      top: element.scrollTop + direction * element.clientHeight * PAGE_FRACTION,
      behavior: 'smooth'
    })
  }

  /** End jump: straight to the first or last pixel. */
  const jumpToEnd = (end: 'top' | 'bottom') => {
    if (!element) return
    element.scrollTo({ top: end === 'top' ? 0 : element.scrollHeight, behavior: 'smooth' })
  }

  /**
   * Page buttons: hover keeps scrolling, click takes one step. The dwell path
   * must NOT also step, or the first frame of the rAF loop would add a page
   * jump on top of the continuous motion.
   */
  const onPageTrigger = (direction: -1 | 1) => (source: 'dwell' | 'click') => {
    if (source === 'dwell') start(direction)
    else jump(direction)
  }

  // Nothing to scroll: no pill at all, and no lift surface registered.
  if (!scrollable) return null

  return (
    <div
      ref={lift.ref}
      className={
        compact
          ? // Centered on the ANSWER region, shifted up just enough that the
            // rail's lowest button clears the 2-row toolbar pill even at the
            // 320px minimum window (pill top ≈ 118px above the window bottom,
            // pill bottom edge sits over the panel's transcript strip).
            'absolute right-0.5 top-[calc(50%_-_2.25rem)] z-10 -translate-y-1/2'
          : 'fixed right-2 top-1/2 z-40 -translate-y-1/2'
      }
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      <div
        className={`flex flex-col items-center gap-0.5 rounded-full ${GLASS_OVERLAY} px-1 py-1 shadow-card`}
      >
        <DwellIconButton
          icon={ArrowUpToLine}
          title={t('scroll.top')}
          disabled={atTop}
          durationMs={dwell()}
          onTrigger={() => jumpToEnd('top')}
        />
        <DwellIconButton
          icon={ChevronUp}
          title={t('scroll.up')}
          disabled={atTop}
          durationMs={dwell()}
          onTrigger={onPageTrigger(-1)}
          onHoverEnd={stop}
        />
        <DwellIconButton
          icon={ChevronDown}
          title={t('scroll.down')}
          disabled={atBottom}
          durationMs={dwell()}
          onTrigger={onPageTrigger(1)}
          onHoverEnd={stop}
        />
        <DwellIconButton
          icon={ArrowDownToLine}
          title={t('scroll.bottom')}
          disabled={atBottom}
          durationMs={dwell()}
          onTrigger={() => jumpToEnd('bottom')}
        />
      </div>
    </div>
  )
}
