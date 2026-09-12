import { streamText, type ModelMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { settings, AppSettings } from './settings'

// The system prompt is fully managed by the renderer (prompt scenes in the
// settings store) and synced here via updateAppSettings on app startup
function getSystemPrompt(extra?: string) {
  return [settings.customPrompt, extra].filter(Boolean).join('\n\n') || undefined
}

function getModel(_settings: AppSettings) {
  const fallbackModel = settings.apiBaseURL.includes('siliconflow')
    ? 'Qwen/Qwen3-VL-32B-Instruct'
    : 'gpt-5-mini'
  return _settings.model || fallbackModel
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
  const openai = createOpenAI({
    baseURL: settings.apiBaseURL,
    apiKey: settings.apiKey
  })

  let streamError: unknown = null
  const { textStream } = streamText({
    model: openai.chat(getModel(settings)),
    system: getSystemPrompt(extraPrompt),
    messages,
    abortSignal,
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
  return createModelStream(
    messages,
    abortSignal,
    '注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。'
  )
}
