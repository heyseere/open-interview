import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store/app'

/**
 * Mouse-passthrough hover lift for floating overlays.
 *
 * While passthrough is on, the main process uses
 * `setIgnoreMouseEvents(true, { forward: true })` so synthetic mousemove
 * events still reach the page. An overlay can therefore notice the pointer
 * entering its own rect, lift passthrough (making it clickable) and restore
 * it when the pointer leaves.
 *
 * ONE module-level mousemove listener serves every overlay: each hook
 * instance registers its element (rect + hit padding) and the shared listener
 * hit-tests all of them per event. Registered overlays: the hover toolbar,
 * the scroll rail, the header actions, the compact panel's back button and
 * resize grip, the follow-up dialog, the history dialog, and whole secondary
 * pages (PageShell — with passthrough on, settings/help/permissions must stay
 * interactive: leaving the coder page must never strand the user in a
 * click-through UI).
 *
 * Coordinator state:
 * - `passthrough` (user intent) decides WHETHER hovering may lift. `ignoreMouse`
 *   (effective value) decides whether a lift is currently in place. They are
 *   deliberately different fields: a lift writes `ignoreMouse:false` and
 *   leaves the intent alone, so the header toggle keeps reading "on" while the
 *   window is momentarily clickable — and can therefore turn it off.
 * - `lastPointer` re-hit-tests where the pointer already is whenever
 *   passthrough (re-)engages. Without it a lift would need one more physical
 *   mousemove after every restore/enable/remount — which reads as "hover
 *   trigger is dead until I wiggle the mouse".
 * - Leaving the window drops pointer-held lifts (document mouseleave);
 *   `hold` surfaces (open dialogs, secondary pages) keep theirs.
 */

/** Defer the restore briefly: moving between two adjacent overlays would
 * otherwise flicker passthrough on and off. */
const RESTORE_DELAY_MS = 40

interface Surface {
  pad: number
  /** Live `hold` flag of the owning hook instance. */
  holdRef: { current: boolean }
}

const surfaces = new Map<HTMLElement, Surface>()
/** Overlays currently holding a lift (pointer inside, or held by `hold`). */
const holders = new Set<HTMLElement>()
/** Overlays held by `hold` — leaving the window must not drop these. */
const holdHolders = new Set<HTMLElement>()
let restoreTimer: ReturnType<typeof setTimeout> | null = null
let liftedActive = false
let lastPointer: { x: number; y: number } | null = null
let listenersBound = false
let prevPassthrough = useAppStore.getState().passthrough

function cancelRestoreTimer(): void {
  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
}

/**
 * Apply or drop the lift. Restoring writes the INTENT back (never a hardcoded
 * true): if the user turned passthrough off while an overlay was lifted, the
 * restore must not re-arm it.
 */
function applyLift(lifted: boolean): void {
  liftedActive = lifted
  const { setIgnoreMouse, passthrough } = useAppStore.getState()
  const next = !lifted && passthrough
  setIgnoreMouse(next)
  void window.api.updateAppState({ ignoreMouse: next })
}

function isInside(surface: Surface, element: HTMLElement, x: number, y: number): boolean {
  const rect = element.getBoundingClientRect()
  return (
    x >= rect.left - surface.pad &&
    x <= rect.right + surface.pad &&
    y >= rect.top - surface.pad &&
    y <= rect.bottom + surface.pad
  )
}

/**
 * Re-hit-test the last known pointer position and lift if it sits on any
 * overlay. Runs whenever passthrough (re-)engages: the pointer may already
 * be over a surface, and no new mousemove arrives until it moves.
 */
function rehitLastPointer(): void {
  if (liftedActive || !lastPointer) return
  for (const [element, surface] of surfaces) {
    if (!isInside(surface, element, lastPointer.x, lastPointer.y)) continue
    holders.add(element)
    cancelRestoreTimer()
    applyLift(true)
    return
  }
}

function onMove(event: MouseEvent): void {
  lastPointer = { x: event.clientX, y: event.clientY }
  const { passthrough } = useAppStore.getState()
  // Fast path: with the intent off and no lift in place the loop below is a
  // guaranteed no-op — but it runs at mousemove rate, and its
  // getBoundingClientRect calls can force synchronous layouts while the
  // streaming answer keeps layout dirty. lastPointer is still recorded, so
  // rehitLastPointer keeps working when the intent re-engages.
  if (!passthrough && !liftedActive && holders.size === 0 && holdHolders.size === 0) return
  // Read the store live (not a React ref): a restore that fired this frame
  // must be seen immediately, or re-entering events get dropped until the
  // next commit and the surface stays click-through.
  const { ignoreMouse } = useAppStore.getState()
  for (const [element, surface] of surfaces) {
    if (isInside(surface, element, event.clientX, event.clientY)) {
      if (surface.holdRef.current || holders.has(element)) continue
      if (!ignoreMouse) {
        // Already clickable: if that is our own lift, just register so the
        // restore waits for this overlay too. When passthrough is off,
        // liftedActive is false and we keep out.
        if (liftedActive) holders.add(element)
        continue
      }
      holders.add(element)
      cancelRestoreTimer()
      applyLift(true)
      return
    }
    if (!holders.has(element) || surface.holdRef.current) continue
    holders.delete(element)
  }
  if (holders.size === 0 && !restoreTimer && liftedActive) {
    restoreTimer = setTimeout(() => {
      restoreTimer = null
      if (holders.size === 0) applyLift(false)
    }, RESTORE_DELAY_MS)
  }
}

function onLeave(): void {
  lastPointer = null
  if (!liftedActive) return
  for (const element of [...holders]) {
    if (!holdHolders.has(element)) holders.delete(element)
  }
  cancelRestoreTimer()
  if (holders.size === 0) applyLift(false)
}

function ensureListeners(): void {
  if (listenersBound) return
  listenersBound = true
  window.addEventListener('mousemove', onMove)
  document.addEventListener('mouseleave', onLeave)
}

/**
 * The intent is the only thing that voids lifts. Turning passthrough ON while
 * we held a lift means the window must go click-through again right now, so
 * forget every holder and re-hit-test where the pointer is (a stationary
 * pointer over an overlay must lift immediately instead of waiting for its
 * next move). Turning it OFF drops the lift too — the whole window is
 * interactive, so no overlay needs to claim it.
 */
useAppStore.subscribe((state) => {
  if (prevPassthrough === state.passthrough) return
  prevPassthrough = state.passthrough
  holders.clear()
  cancelRestoreTimer()
  liftedActive = false
  if (state.passthrough) rehitLastPointer()
})

interface HoverLiftOptions {
  /** Extra hit padding in px around the rect. */
  pad?: number
  /**
   * While true the overlay stays lifted regardless of the pointer position —
   * used by portal surfaces (open selects, dialogs) and whole secondary pages.
   */
  hold?: boolean
}

/**
 * Register an overlay with the shared lift coordinator. Returns a callback
 * ref to spread on the overlay element; the element flows in through state,
 * so arming survives mount order and the toolbar being toggled off and back
 * on (a plain ref read at effect time captures null and never arms — that
 * exact bug killed the hover trigger once).
 */
export function usePassthroughLift({ pad = 8, hold = false }: HoverLiftOptions = {}): {
  ref: (node: HTMLElement | null) => void
} {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const ref = useCallback((node: HTMLElement | null) => setElement(node), [])
  // Subscribed for the hold effect below: it must re-run (and re-assert the
  // hold) after the coordinator forgets all holders on an intent flip.
  const passthrough = useAppStore((state) => state.passthrough)
  const holdRef = useRef(hold)
  holdRef.current = hold

  useEffect(() => {
    if (!element) return
    ensureListeners()
    surfaces.set(element, { pad, holdRef })
    return () => {
      surfaces.delete(element)
      holdHolders.delete(element)
      if (!holders.delete(element)) return
      if (holders.size === 0 && liftedActive) {
        cancelRestoreTimer()
        applyLift(false)
      }
    }
  }, [element, pad])

  // `hold` surfaces (open select, dialog, secondary page) must stay lifted
  // even when the pointer wanders outside the registered rect. The release
  // MUST happen only on a true→false transition of `hold`: this effect also
  // re-runs whenever the intent flips (i.e. on every lift/restore), and an
  // unconditional release there would unregister the overlay mid-lift and
  // instantly undo it. The `holdHolders` membership check is that guard.
  useEffect(() => {
    if (!element) return
    if (hold && passthrough) {
      holdHolders.add(element)
      if (!holders.has(element)) {
        holders.add(element)
        cancelRestoreTimer()
        if (!liftedActive) applyLift(true)
      }
    } else if (
      holdHolders.delete(element) &&
      holders.delete(element) &&
      holders.size === 0 &&
      liftedActive
    ) {
      cancelRestoreTimer()
      applyLift(false)
    }
  }, [element, hold, passthrough])

  return { ref }
}
