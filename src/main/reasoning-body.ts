/**
 * Provider-native thinking parameters.
 *
 * The app speaks the OpenAI-compatible chat completions protocol to every
 * provider, but "deep thinking" is not standardized there: OpenAI (and most
 * gateways) take `reasoning_effort`, while DeepSeek/Qwen/智谱 expect their own
 * body fields and may ignore `reasoning_effort` entirely. The 2025-era
 * `/v1/models` schema publishes no capability metadata at all, so the app must
 * never gate the control on detection — it always lets the user choose and
 * simply sends what the selected provider understands.
 *
 * Pure functions, unit-tested; the request-body merge lives in ai.ts.
 */

/** Provider families with a native thinking switch. */
export const THINKING_KINDS = ['openai', 'generic', 'deepseek', 'zhipu', 'qwen'] as const
export type ThinkingKind = (typeof THINKING_KINDS)[number]

export type ThinkingEffort = 'off' | 'low' | 'medium' | 'high'

export interface ThinkingBodyOptions {
  kind: ThinkingKind
  effort: ThinkingEffort
  /** The model override can be a non-reasoning variant (e.g. deepseek-chat). */
  model: string
}

/** DeepSeek accepts low/high/max only; `medium` maps onto `high`. */
function deepSeekEffort(effort: Exclude<ThinkingEffort, 'off'>): 'low' | 'high' {
  return effort === 'low' ? 'low' : 'high'
}

/**
 * Body fields to merge into the chat-completions request. Returns `{}` when
 * the provider has no native control (the generic `reasoning_effort` path in
 * ai.ts covers those).
 *
 * Notes:
 * - `openai` keeps using the SDK's `reasoningEffort` provider option, which
 *   the SDK serializes to `reasoning_effort`; nothing extra here.
 * - DeepSeek/Qwen default thinking ON, so `off` must be sent EXPLICITLY as a
 *   disable, not omitted.
 */
export function thinkingBody(options: ThinkingBodyOptions): Record<string, unknown> {
  const { kind, effort } = options
  const enabled = effort !== 'off'

  switch (kind) {
    case 'deepseek':
      return enabled
        ? {
            thinking: { type: 'enabled' },
            reasoning_effort: deepSeekEffort(effort as Exclude<ThinkingEffort, 'off'>)
          }
        : { thinking: { type: 'disabled' } }
    case 'qwen':
      return { enable_thinking: enabled }
    case 'zhipu':
      // GLM-4.5+ takes a boolean toggle under `thinking`.
      return { thinking: { type: enabled ? 'enabled' : 'disabled' } }
    default:
      return {}
  }
}

/** Whether a generic reasoning_effort should be sent for this kind. */
export function usesGenericReasoningEffort(kind: ThinkingKind): boolean {
  return kind === 'openai' || kind === 'generic'
}
