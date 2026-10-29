/**
 * Payload of the `solution-error` IPC channel, shared by main (emitter) and
 * renderer (error row). `action` tells the error row which repair affordance
 * to render — the message text alone cannot express "fix this in Settings",
 * and a generic Retry button on a permission failure just replays an AI
 * request that cannot succeed.
 */
export type SolutionErrorAction = 'retry' | 'open-permissions' | 'open-settings'

export interface SolutionErrorPayload {
  message: string
  action?: SolutionErrorAction
}
