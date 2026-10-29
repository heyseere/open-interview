/**
 * Pure decision helpers for the streaming lifecycle (no Electron, no AI SDK)
 * — extracted from streaming.ts so the "latest request wins" guard's truth
 * table stays unit-testable (the permissions-policy.ts idiom).
 *
 * The invariant both helpers encode: a newer request owns the UI and the
 * conversation state. An aborted run must neither append its buffered tail to
 * the successor's text, nor end the successor's loading state, nor roll the
 * successor's conversation state back.
 */

/**
 * finally-block disposition of one AI stream run.
 *
 * - `flushTail`: deliver the ≤80ms buffered chunk tail. Suppressed when a
 *   successor stream took over (its ai-loading-start and text must not be
 *   polluted) or when the sequence went stale via a session reset.
 * - `sendLoadingEnd`: end the loading spinner. Suppressed only when a
 *   successor stream took over (it manages loading itself); a session reset
 *   (stale seq, no successor) still needs it — nothing else will send it.
 */
export interface StreamTailPlan {
  flushTail: boolean
  sendLoadingEnd: boolean
}

export function planStreamTail(input: { replaced: boolean; stale: boolean }): StreamTailPlan {
  return {
    flushTail: !input.replaced && !input.stale,
    sendLoadingEnd: !input.replaced
  }
}

export type StreamErrorSource = 'caught' | 'stream' | 'empty' | null

export interface StreamEndInput {
  /** A newer request generation owns the sequence. */
  stale: boolean
  /** The stream was aborted (user stop or superseded). */
  aborted: boolean
  stoppedByUser: boolean
  /** The stream threw or the provider reported an error part. */
  errored: boolean
  /** Which error the caller has in hand (null when the stream ran clean). */
  errorSource: 'caught' | 'stream' | null
  /** The stream ended cleanly with no output at all. */
  empty: boolean
}

export interface TurnPlan {
  ok: boolean
  /** Commit the assistant response and emit solution-complete. */
  commit: boolean
  /** Emit solution-error (message selected by `errorSource`). */
  sendError: boolean
  errorSource: StreamErrorSource
  /** Emit solution-stopped (user stop only). */
  sendStopped: boolean
  /** Roll the conversation back to the pre-turn lengths. */
  rollback: boolean
}

/**
 * Post-stream outcome of one conversation turn. Truth table (verified by
 * stream-guard.test.ts):
 *
 * | stale | aborted | stoppedByUser | errored | empty | → outcome
 * | yes   | *       | *             | *       | *     | silent no-op (successor owns everything)
 * | no    | yes     | yes           | *       | *     | sendStopped
 * | no    | yes     | no            | *       | *     | silent (successor announces itself)
 * | no    | no      | *             | yes     | *     | sendError + rollback
 * | no    | no      | *             | no      | yes   | sendError(empty) + rollback
 * | no    | no      | *             | no      | no    | commit + sendComplete + ok
 */
export function planTurnEnd(input: StreamEndInput): TurnPlan {
  const silent: TurnPlan = {
    ok: false,
    commit: false,
    sendError: false,
    errorSource: null,
    sendStopped: false,
    rollback: false
  }
  // A newer request owns the sequence: it also owns the UI events and the
  // conversation state — this run must neither send nor roll back.
  if (input.stale) return silent
  if (input.aborted) {
    if (!input.stoppedByUser) return silent
    return { ...silent, sendStopped: true }
  }
  if (input.errored) {
    return { ...silent, sendError: true, errorSource: input.errorSource, rollback: true }
  }
  // A clean stream that produced nothing would otherwise leave a dangling
  // unanswered question behind — surface it as a failure so the turn rolls back.
  if (input.empty) {
    return { ...silent, sendError: true, errorSource: 'empty', rollback: true }
  }
  return { ...silent, ok: true, commit: true }
}
