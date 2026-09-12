import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelMessage } from 'ai'
import { tMain } from './i18n'

/**
 * Text-only archive of past conversations (for review/复盘).
 *
 * Screenshots are intentionally NOT persisted — only the textual turns are
 * kept, which keeps the file small and avoids storing sensitive screen
 * content on disk beyond the user-controlled screenshot auto-save feature.
 */

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
    const parsed = JSON.parse(raw)
    cache = Array.isArray(parsed) ? parsed : []
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

export function deriveTitle(text: string): string {
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
