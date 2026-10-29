import { useEffect, useRef } from 'react'

/**
 * Scroll behaviour for the streamed answer: the view stays where the user put
 * it.
 *
 * The old behaviour followed the newest chunk (scrolling to the bottom), which
 * yanked the reader away from the beginning of a just-started answer. Now:
 * - a NEW answer (`reset` flips) jumps to the top — that is where reading
 *   starts;
 * - chunks arriving during the stream never scroll by themselves, so a reader
 *   can stay on the first lines (or anywhere else) while text grows below.
 *
 * `reset` should be a value that changes exactly once per new answer (the
 * store's `resetEpoch`, or an emptied buffer).
 *
 * Returns the container ref to attach to the scroll element.
 */
export function useKeepTopScroll<T extends HTMLElement>(
  reset: unknown
): {
  ref: React.RefObject<T | null>
} {
  const ref = useRef<T | null>(null)
  const resetRef = useRef(reset)

  useEffect(() => {
    if (resetRef.current === reset) return
    resetRef.current = reset
    const el = ref.current
    if (el) el.scrollTop = 0
  }, [reset])

  return { ref }
}
