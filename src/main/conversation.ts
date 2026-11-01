import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelMessage } from 'ai'
import { tMain } from './i18n'

/**
 * The conversation module, in two sections:
 *
 * 1. The pure in-memory state machine shared by all AI streaming flows. It is
 *    mutated in place so references stay stable across a turn; `commitTurn`
 *    normalizes the history to exactly `[...requestMessages, assistantResponse]`
 *    after a successful stream, which also gives retries clean semantics
 *    (failed attempts are dropped). This section is free of side effects so it
 *    stays unit-testable.
 *
 * 2. The text-only archive of past conversations (for review/复盘). Screenshots
 *    are intentionally NOT persisted — only the textual turns are kept, which
 *    keeps the file small and avoids storing sensitive screen content on disk
 *    beyond the user-controlled screenshot auto-save feature.
 */

// ---------------------------------------------------------------------------
// In-memory conversation state (pure)
// ---------------------------------------------------------------------------

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

function imageUserMessage(text: string, images: string[]): ModelMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }, ...images.map((image) => ({ type: 'image' as const, image }))]
  }
}

/**
 * Reset the conversation and start it with a screenshot turn — normally one
 * image, but several images ride in the SAME user message when a caller has
 * them.
 */
export function startWithImage(
  state: ConversationState,
  image: string | string[],
  text = '这是屏幕截图'
): ModelMessage[] {
  const images = Array.isArray(image) ? image : [image]
  const userMessage = imageUserMessage(text, images)
  state.messages = [userMessage]
  state.screenshots = images.slice(-MAX_SCREENSHOTS)
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
  const userMessage = imageUserMessage(text, [image])
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

/** Lengths of both collections, captured before a turn starts. */
export interface ConversationLengths {
  messages: number
  screenshots: number
}

export function getLengths(state: ConversationState): ConversationLengths {
  return { messages: state.messages.length, screenshots: state.screenshots.length }
}

/**
 * Roll back to the captured lengths — used when a turn fails after its user
 * message was already appended, so a failed attempt never leaves a dangling
 * unanswered question (or a preview strip entry) in the conversation.
 */
export function rollbackTo(state: ConversationState, lengths: ConversationLengths): void {
  state.messages = state.messages.slice(0, lengths.messages)
  state.screenshots = state.screenshots.slice(0, lengths.screenshots)
}

// ---------------------------------------------------------------------------
// Conversation history archive (userData persistence)
// ---------------------------------------------------------------------------

const MAX_SESSIONS = 20

export interface ConversationTurn {
  question: string
  answer: string
}

export interface ConversationRecord {
  id: string
  createdAt: number
  updatedAt: number
  /** Short title derived from the first user message. */
  title: string
  turns: ConversationTurn[]
}

export interface ConversationSummary {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  turnCount: number
}

function getHistoryPath(): string {
  return join(app.getPath('userData'), 'conversation-history.json')
}

/** Extract plain text from a ModelMessage content (text parts only). */
function messageToText(message: ModelMessage): string {
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''
  return message.content
    .map((part) => {
      if (part.type === 'text') return part.text
      if (part.type === 'image') return tMain('history.imagePlaceholder')
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

let cache: ConversationRecord[] | null = null

async function load(): Promise<ConversationRecord[]> {
  if (cache) return cache
  try {
    const raw = await readFile(getHistoryPath(), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    // Hand-edited or half-corrupted files must degrade to "fewer sessions",
    // not crash every history read: listConversations destructures each
    // record, so a null entry would throw forever (the bad cache is kept).
    cache = Array.isArray(parsed)
      ? parsed.filter(
          (r): r is ConversationRecord =>
            !!r &&
            typeof r === 'object' &&
            typeof (r as ConversationRecord).id === 'string' &&
            Array.isArray((r as ConversationRecord).turns)
        )
      : []
  } catch {
    cache = []
  }
  return cache
}

async function persist(records: ConversationRecord[]): Promise<void> {
  const filePath = getHistoryPath()
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    // Atomic-ish write: write to a temp file then replace
    await writeFile(`${filePath}.tmp`, JSON.stringify(records, null, 2), 'utf-8')
    await rename(`${filePath}.tmp`, filePath)
  } catch (error) {
    console.error('Failed to persist conversation history:', error)
  }
}

function deriveTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return tMain('history.blankTitle')
  return normalized.length > 30 ? `${normalized.slice(0, 30)}…` : normalized
}

/** Insert or replace a session record in the archive (called after each turn). */
export async function upsertSession(record: ConversationRecord): Promise<void> {
  const records = await load()
  const index = records.findIndex((r) => r.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.unshift(record)
  }
  if (records.length > MAX_SESSIONS) records.length = MAX_SESSIONS
  await persist(records)
}

/** Append a completed Q/A turn to the given session record. */
export function endTurn(
  record: ConversationRecord | null,
  requestMessages: ModelMessage[],
  assistantResponse: string
): ConversationRecord {
  // The last user message in the request is this turn's question
  const lastUser = [...requestMessages].reverse().find((m) => m.role === 'user')
  const question = lastUser ? messageToText(lastUser) : ''
  const now = Date.now()
  const next: ConversationRecord = record ?? {
    // A timestamp alone collides for sessions created within the same
    // millisecond (the second upsert would replace the first), so keep a
    // short random suffix as a tie-breaker.
    id: `session-${now}-${randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    title: '',
    turns: []
  }
  next.updatedAt = now
  next.turns.push({ question, answer: assistantResponse })
  if (!next.title) next.title = deriveTitle(question)
  return next
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const records = await load()
  return records.map(({ id, createdAt, updatedAt, title, turns }) => ({
    id,
    createdAt,
    updatedAt,
    title,
    turnCount: turns.length
  }))
}

export async function getConversation(id: string): Promise<ConversationRecord | null> {
  const records = await load()
  return records.find((r) => r.id === id) ?? null
}

export async function deleteConversation(id: string): Promise<void> {
  const records = await load()
  const next = records.filter((r) => r.id !== id)
  if (next.length !== records.length) {
    cache = next
    await persist(next)
  }
}
