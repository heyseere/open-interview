import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendImage,
  appendText,
  commitTurn,
  createConversationState,
  getLengths,
  isActive,
  MAX_SCREENSHOTS,
  resetConversation,
  rollbackTo,
  startWithImage,
  startWithText
} from './conversation'

/**
 * The merged conversation module also persists history (Electron app paths +
 * fs), so the whole suite runs against a mocked electron with a temp data
 * dir. The history section additionally caches its records in module scope
 * (by design for the app), so its tests use `vi.resetModules()` + dynamic
 * import for a fresh module instance.
 */
const dataDir = await mkdtemp(join(tmpdir(), 'icn-history-'))
vi.mock('electron', () => ({
  app: { getPath: () => dataDir }
}))

const IMG_A = 'base64-a'
const IMG_B = 'base64-b'

describe('createConversationState', () => {
  it('starts empty and inactive', () => {
    const state = createConversationState()
    expect(state.messages).toEqual([])
    expect(state.screenshots).toEqual([])
    expect(isActive(state)).toBe(false)
  })
})

describe('startWithImage', () => {
  it('resets prior content and seeds a single image message', () => {
    const state = createConversationState()
    startWithText(state, '旧对话')
    const request = startWithImage(state, IMG_A)
    expect(request).toHaveLength(1)
    expect(request[0].role).toBe('user')
    expect(isActive(state)).toBe(true)
    expect(state.screenshots).toEqual([IMG_A])
  })

  it('supports custom caption text', () => {
    const state = createConversationState()
    const request = startWithImage(state, IMG_A, '看这道题')
    const content = request[0].content as Array<{ type: string; text?: string }>
    expect(content[0]).toEqual({ type: 'text', text: '看这道题' })
    expect(content[1]).toEqual({ type: 'image', image: IMG_A })
  })
})

describe('appendImage', () => {
  it('appends to existing history without mutating the previous snapshot', () => {
    const state = createConversationState()
    const firstRequest = startWithImage(state, IMG_A)
    const secondRequest = appendImage(state, IMG_B)

    expect(secondRequest).toHaveLength(2)
    expect(firstRequest).toHaveLength(1)
    expect(state.messages).toEqual(secondRequest)
  })

  it('caps the screenshot strip at MAX_SCREENSHOTS while keeping all messages', () => {
    const state = createConversationState()
    startWithImage(state, 'img-0')
    for (let i = 1; i <= MAX_SCREENSHOTS + 2; i++) {
      appendImage(state, `img-${i}`)
    }
    expect(state.screenshots).toHaveLength(MAX_SCREENSHOTS)
    expect(state.screenshots.at(-1)).toBe(`img-${MAX_SCREENSHOTS + 2}`)
    expect(state.messages).toHaveLength(MAX_SCREENSHOTS + 3) // initial + appends
  })
})

describe('appendText', () => {
  it('appends a text-only user turn', () => {
    const state = createConversationState()
    startWithImage(state, IMG_A)
    const request = appendText(state, '换个思路')
    expect(request).toHaveLength(2)
    const last = request[1].content as Array<{ type: string }>
    expect(last.every((part) => part.type === 'text')).toBe(true)
  })
})

describe('commitTurn', () => {
  it('normalizes history to request messages plus assistant response', () => {
    const state = createConversationState()
    const request = startWithText(state, '问题')
    // Simulate an eager extra mutation that must be discarded on commit
    state.messages.push({ role: 'user', content: '脏数据' } as never)
    commitTurn(state, request, '回答')
    expect(state.messages).toEqual([...request, { role: 'assistant', content: '回答' }])
  })

  it('omits empty assistant responses', () => {
    const state = createConversationState()
    const request = startWithText(state, '问题')
    commitTurn(state, request, '')
    expect(state.messages).toEqual(request)
    expect(isActive(state)).toBe(true)
  })
})

describe('resetConversation', () => {
  it('clears everything', () => {
    const state = createConversationState()
    startWithImage(state, IMG_A)
    resetConversation(state)
    expect(isActive(state)).toBe(false)
    expect(state.screenshots).toEqual([])
  })
})

describe('rollbackTo', () => {
  it('drops a failed turn back to the pre-turn state', () => {
    const state = createConversationState()
    startWithImage(state, IMG_A)
    const before = getLengths(state)
    appendImage(state, IMG_B)
    appendText(state, '追问')
    rollbackTo(state, before)
    expect(state.messages).toHaveLength(before.messages)
    expect(state.screenshots).toEqual([IMG_A])
    expect(isActive(state)).toBe(true)
  })

  it('rolls back a failed first turn to an empty conversation', () => {
    const state = createConversationState()
    const before = getLengths(state)
    startWithText(state, '问题')
    rollbackTo(state, before)
    expect(isActive(state)).toBe(false)
    expect(state.screenshots).toEqual([])
  })
})

// --- history archive ---------------------------------------------------------

type ConversationModule = typeof import('./conversation')

async function freshConversation(): Promise<ConversationModule> {
  await rm(join(dataDir, 'conversation-history.json'), { force: true })
  vi.resetModules()
  return import('./conversation')
}

function userMessage(text: string) {
  return { role: 'user' as const, content: [{ type: 'text' as const, text }] }
}

function imageMessage() {
  return { role: 'user' as const, content: [{ type: 'image' as const, image: 'base64-data' }] }
}

describe('conversation history archive', () => {
  let history: ConversationModule

  beforeEach(async () => {
    history = await freshConversation()
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

  it('skips corrupt entries instead of crashing every history read', async () => {
    const good = history.endTurn(null, [userMessage('完好会话')], '答')
    await history.upsertSession(good)
    // Simulate a hand-edited / half-corrupted file: legal JSON array with
    // garbage entries (a null record used to make listConversations throw
    // forever, since the bad cache was kept).
    const raw = await readFile(join(dataDir, 'conversation-history.json'), 'utf-8')
    const parsed = JSON.parse(raw) as unknown[]
    await writeFile(
      join(dataDir, 'conversation-history.json'),
      JSON.stringify([null, 42, { noId: true }, { id: 7, turns: [] }, ...parsed])
    )

    const summaries = await history.listConversations()
    expect(summaries).toHaveLength(1)
    expect(summaries[0].title).toBe('完好会话')
    expect(await history.getConversation(good.id)).not.toBeNull()
  })
})
