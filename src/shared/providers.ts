/**
 * Provider vocabulary shared by main and renderer. The provider `kind`
 * decides which native thinking fields the main process injects into a
 * chat-completions request body (see src/main/reasoning-body.ts); the
 * reasoning effort levels are the user-facing deep-thinking control. Both
 * cross the settings-sync IPC, so main's zod schema and the renderer store
 * must read one declaration.
 */

/** Provider families the app knows (the presets' `kind` values). */
export const PROVIDER_KINDS = ['openai', 'generic', 'deepseek', 'zhipu', 'qwen'] as const
export type ProviderKind = (typeof PROVIDER_KINDS)[number]

/** Deep-thinking effort levels; 'off' sends no reasoning parameter. */
export const REASONING_EFFORTS = ['off', 'low', 'medium', 'high'] as const
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]
