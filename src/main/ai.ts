import { ipcMain } from 'electron'
import { generateText, streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings } from './settings'
import { extractErrorMessage } from './errors'
import { tMain } from './i18n'
import { thinkingBody, usesGenericReasoningEffort, type ThinkingEffort } from './reasoning-body'

// The system prompt is fully managed by the renderer (prompt scenes in the
// settings store) and synced here via updateAppSettings on app startup
function getSystemPrompt(extra?: string) {
  return [settings.customPrompt, extra].filter(Boolean).join('\n\n') || undefined
}

/** The active provider's key: the per-provider encrypted map, else legacy env. */
function getApiKey(): string {
  return settings.providerApiKey || settings.apiKey
}

function getModel(): string {
  if (settings.model) return settings.model
  return settings.providerKind === 'deepseek' ? 'deepseek-chat' : 'gpt-5-mini'
}

/**
 * OpenAI-family provider options: deep thinking rides on
 * `providerOptions.openai.reasoningEffort`, serialized to `reasoning_effort`.
 * Sent whenever the user selected an effort — the model list is not a
 * reliable capability signal (most providers publish nothing), so the user's
 * choice always wins. Providers with a native switch use reasoning-body.ts
 * instead (see createModelStream).
 */
function getProviderOptions() {
  if (settings.reasoningEffort === 'off') return undefined
  if (!usesGenericReasoningEffort(settings.providerKind)) return undefined
  return { openai: { reasoningEffort: settings.reasoningEffort } }
}

/**
 * Inject provider-native thinking fields into the JSON request body.
 * A custom `fetch` is the only hook the OpenAI SDK exposes for arbitrary body
 * fields (DeepSeek `thinking`, Qwen `enable_thinking`, 智谱 `thinking`), and
 * it keeps the injection next to the request it belongs to.
 */
function createThinkingFetch(kind: typeof settings.providerKind) {
  const bodyFields = thinkingBody({
    kind,
    effort: settings.reasoningEffort as ThinkingEffort,
    model: getModel()
  })
  if (Object.keys(bodyFields).length === 0) return undefined

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = init?.body
    if (typeof body === 'string') {
      try {
        const merged = { ...(JSON.parse(body) as Record<string, unknown>), ...bodyFields }
        return fetch(input, { ...init, body: JSON.stringify(merged) })
      } catch {
        // Not JSON (should not happen for chat completions) — send as-is
      }
    }
    return fetch(input, init)
  }
}

/** Build the provider client for the ACTIVE provider. */
function createClient() {
  return createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: getApiKey(),
    fetch: createThinkingFetch(settings.providerKind)
  })
}

export interface ModelStream {
  textStream: AsyncIterable<string>
  /**
   * Provider-reported stream error, if any. ai@5 swallows errors thrown from
   * onError (its notify() ignores callback exceptions) and drops the error
   * part out of textStream, so the consuming loop must check this after the
   * stream ends — otherwise a mid-stream failure looks like a complete
   * (truncated) answer.
   */
  getError: () => unknown
}

function createModelStream(
  messages: ModelMessage[],
  abortSignal?: AbortSignal,
  extraPrompt?: string
): ModelStream {
  const client = createClient()

  let streamError: unknown = null
  const { textStream } = streamText({
    model: client.chat(getModel()),
    system: getSystemPrompt(extraPrompt),
    messages,
    abortSignal,
    providerOptions: getProviderOptions(),
    // Re-throwing here is a no-op (see getError) — record instead
    onError: (err) => {
      streamError = err.error ?? err
    }
  })
  return { textStream, getError: () => streamError }
}

export function getSolutionStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  return createModelStream(messages, abortSignal)
}

export function getGeneralStream(messages: ModelMessage[], abortSignal?: AbortSignal) {
  return createModelStream(messages, abortSignal, tMain('prompt.multiScreenshotNote'))
}

/**
 * Minimal one-shot request for the settings-page "test connection" button —
 * a mis-typed Base URL / Key / model otherwise only surfaces when the first
 * screenshot fails. Uses the exact same provider config as the real streams,
 * including the thinking fields, so a green test means the real request works.
 */
export async function testAiConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await generateText({
      model: createClient().chat(getModel()),
      prompt: 'Reply with OK.',
      maxOutputTokens: 16,
      abortSignal: AbortSignal.timeout(20_000),
      providerOptions: getProviderOptions()
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error, tMain('err.unknown')) }
  }
}

ipcMain.handle('test-ai-connection', () => testAiConnection())
