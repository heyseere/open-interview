import { describe, expect, it } from 'vitest'
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
