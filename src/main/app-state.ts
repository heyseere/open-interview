/**
 * Mouse-passthrough state machine (pure, no Electron).
 *
 * `passthrough` is the USER'S INTENT ("make the window click-through");
 * `ignoreMouse` is the EFFECTIVE value handed to `setIgnoreMouseEvents`.
 * They diverge whenever the renderer's hover coordinator temporarily lifts
 * passthrough so an overlay stays clickable — the intent is still "on".
 *
 * Conflating the two was the original bug: the lift wrote `ignoreMouse:false`,
 * the header button then read that lifted value and "toggled" it back to
 * true, main re-armed passthrough, the coordinator lifted again, and the
 * button could never turn passthrough off while the pointer was hovering the
 * header — which is the only time it is clickable at all.
 *
 * Two rules keep the pair coherent:
 * - A lift may only ever CLEAR `ignoreMouse`; it can never arm passthrough
 *   (`ignoreMouse && passthrough`), so a stale lift can never re-enable a mode
 *   the user turned off.
 * - Only the toggle changes `passthrough`, and it applies the new intent
 *   immediately so the window never sits in a half state.
 */

export interface AppState {
  inCoderPage: boolean
  /** User intent: passthrough requested. Survives hover lifts. */
  passthrough: boolean
  /** Effective `setIgnoreMouseEvents` value. */
  ignoreMouse: boolean
}

/** The intent, expressed as the effective value with no lift applied. */
function intentToEffective(passthrough: boolean): boolean {
  return passthrough
}

/**
 * Merge a renderer patch into `current`, in place. Returns whether
 * `ignoreMouse` changed (the only field that needs a native window call).
 *
 * `ignoreMouse` in a patch is a LIFT REQUEST, not an intent: it is honoured
 * only as "go click-through because the intent is on". A lift that asks for
 * `false` while the intent is off is a no-op, which is what keeps the
 * coordinator from fighting an explicit disable.
 */
export function applyAppStatePatch(current: AppState, patch: unknown): boolean {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false
  const fields = patch as Record<string, unknown>
  const before = current.ignoreMouse

  if (typeof fields.inCoderPage === 'boolean') current.inCoderPage = fields.inCoderPage

  if (typeof fields.passthrough === 'boolean') {
    current.passthrough = fields.passthrough
    current.ignoreMouse = intentToEffective(current.passthrough)
  }

  if (typeof fields.ignoreMouse === 'boolean') {
    // Lift (false) always wins; arming (true) requires the intent.
    current.ignoreMouse = fields.ignoreMouse && current.passthrough
  }

  return current.ignoreMouse !== before
}

/**
 * Flip the user's intent. Returns the effective value that must be pushed to
 * the window; callers broadcast the whole state afterwards.
 */
export function togglePassthroughState(current: AppState): boolean {
  current.passthrough = !current.passthrough
  current.ignoreMouse = intentToEffective(current.passthrough)
  return current.ignoreMouse
}
