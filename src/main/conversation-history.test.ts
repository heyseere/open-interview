import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The history module caches its records in module scope (by design for the
 * app), so each test needs a FRESH module instance plus a temp data dir:
 * `vi.resetModules()` + dynamic import gives us clean isolation.
 */
const dataDir = await mkdtemp(join(tmpdir(), 'icn-history-'))
vi.mock('electron', () => ({
  app: { getPath: () => dataDir }
}))

type HistoryModule = typeof import('./conversation-history')

async function freshHistory(): Promise<HistoryModule> {
  await rm(join(dataDir, 'conversation-history.json'), { force: true })
  vi.resetModules()
  return import('./conversation-history')
}

function userMessage(text: string) {
  return { role: 'user' as const, content: [{ type: 'text' as const, text }] }
}

function imageMessage() {
  return { role: 'user' as const, content: [{ type: 'image' as const, image: 'base64-data' }] }
}

describe('conversation-history', () => {
  let history: HistoryModule

  beforeEach(async () => {
    history = await freshHistory()
  })

  it('creates a record from a turn and persists it', async () => {
    const record = history.endTurn(null, [userMessage('1+1 等于多少?')], '等于 2')
    await history.upsertSession(record)

    const summaries = await history.listConversations()
    expect(summaries).toHaveLength(1)
    expect(summaries[0].title).toBe('1+1 等于多少?')
    expect(summaries[0].turnCount).toBe(1)
  })

  it('appends turns to the same session and refreshes its timestamp', async () => {
    let record = history.endTurn(null, [userMessage('第一问')], '第一答')
    await history.upsertSession(record)
    record = history.endTurn(record, [record, userMessage('第二问')] as never, '第二答')
    await history.upsertSession(record)

    const stored = await history.getConversation(record.id)
    expect(stored?.turns).toHaveLength(2)
    expect(stored?.turns[1]).toEqual({ question: '第二问', answer: '第二答' })
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(stored!.createdAt)
  })

  it('keeps text only — image parts become a placeholder, never raw data', async () => {
    const record = history.endTurn(null, [imageMessage()], '识别结果')
    await history.upsertSession(record)
    const raw = await readFile(join(dataDir, 'conversation-history.json'), 'utf-8')
    expect(raw).not.toContain('base64-data')
    const stored = await history.getConversation(record.id)
    expect(stored?.turns[0].question).toBe('[截图]')
  })

  it('caps the archive at 20 sessions, newest first', async () => {
    for (let i = 0; i < 23; i++) {
      const record = history.endTurn(null, [userMessage(`问题 ${i}`)], `答案 ${i}`)
      record.createdAt = 1000 + i
      record.updatedAt = 1000 + i
      await history.upsertSession(record)
    }
    const summaries = await history.listConversations()
    expect(summaries).toHaveLength(20)
    expect(summaries[0].title).toBe('问题 22')
    expect(summaries.at(-1)?.title).toBe('问题 3')
  })

  it('deletes a conversation and leaves the rest intact', async () => {
    const a = history.endTurn(null, [userMessage('A')], 'a')
    const b = history.endTurn(null, [userMessage('B')], 'b')
    await history.upsertSession(a)
    await history.upsertSession(b)

    await history.deleteConversation(a.id)
    expect(await history.getConversation(a.id)).toBeNull()
    expect(await history.getConversation(b.id)).not.toBeNull()
  })

  it('truncates very long questions into a titled ellipsis', async () => {
    const record = history.endTurn(null, [userMessage('x'.repeat(60))], '答')
    await history.upsertSession(record)
    const summaries = await history.listConversations()
    expect(summaries[0].title.endsWith('…')).toBe(true)
    expect(summaries[0].title.length).toBeLessThanOrEqual(31)
  })
})
