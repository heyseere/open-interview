import type { ModelMessage } from 'ai'

/**
 * Pure conversation state shared by all AI streaming flows.
 *
 * The state is mutated in place so references stay stable across a turn;
 * `commitTurn` normalizes the history to exactly
 * `[...requestMessages, assistantResponse]` after a successful stream,
 * which also gives retries clean semantics (failed attempts are dropped).
 */

export const MAX_SCREENSHOTS = 5

export interface ConversationState {
  messages: ModelMessage[]
  /** Recent screenshots for the horizontal preview strip (capped). */
  screenshots: string[]
}

export function createConversationState(): ConversationState {
  return { messages: [], screenshots: [] }
}

export function isActive(state: ConversationState): boolean {
  return state.messages.length > 0
}

function textUserMessage(text: string): ModelMessage {
  return { role: 'user', content: [{ type: 'text', text }] }
}

function imageUserMessage(text: string, image: string): ModelMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image', image }
    ]
  }
}

/** Reset the conversation and start it with a screenshot. */
export function startWithImage(
  state: ConversationState,
  image: string,
  text = '这是屏幕截图'
): ModelMessage[] {
  const userMessage = imageUserMessage(text, image)
  state.messages = [userMessage]
  state.screenshots = [image]
  return [userMessage]
}

/** Reset the conversation and start it with a plain text message. */
export function startWithText(state: ConversationState, text: string): ModelMessage[] {
  const userMessage = textUserMessage(text)
  state.messages = [userMessage]
  state.screenshots = []
  return [userMessage]
}

/** Append a follow-up screenshot; returns the full request messages snapshot. */
export function appendImage(
  state: ConversationState,
  image: string,
  text = '这是下一部分截图，请结合之前所有截图和分析，继续分析解答，不要遗漏任何信息。'
): ModelMessage[] {
  const userMessage = imageUserMessage(text, image)
  state.messages = [...state.messages, userMessage]
  state.screenshots = [...state.screenshots, image].slice(-MAX_SCREENSHOTS)
  return [...state.messages]
}

/** Append a plain-text user turn; returns the full request messages snapshot. */
export function appendText(state: ConversationState, text: string): ModelMessage[] {
  const userMessage = textUserMessage(text)
  state.messages = [...state.messages, userMessage]
  return [...state.messages]
}

/**
 * Normalize history after a successful assistant response:
 * `[...requestMessages, assistant]`. Passing the exact request snapshot that
 * was streamed makes this idempotent and retry-safe.
 */
export function commitTurn(
  state: ConversationState,
  requestMessages: ModelMessage[],
  assistantResponse: string
): void {
  const messages = [...requestMessages]
  if (assistantResponse) {
    messages.push({ role: 'assistant', content: assistantResponse })
  }
  state.messages = messages
}

/** Drop the current conversation entirely (new session). */
export function resetConversation(state: ConversationState): void {
  state.messages = []
  state.screenshots = []
}
