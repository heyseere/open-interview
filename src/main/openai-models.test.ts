import { describe, expect, it } from 'vitest'
import { parseModelList } from './openai-models'

describe('parseModelList', () => {
  it('parses plain ids and sorts them', () => {
    const models = parseModelList({ data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }] })
    expect(models).toEqual([
      { id: 'gpt-3.5-turbo', reasoning: false },
      { id: 'gpt-4o', reasoning: false }
    ])
  })

  it('deduplicates ids, first occurrence wins', () => {
    const models = parseModelList({
      data: [{ id: 'm1', supported_parameters: ['reasoning'] }, { id: 'm1' }]
    })
    expect(models).toEqual([{ id: 'm1', reasoning: true }])
  })

  it('detects reasoning from OpenRouter-style supported_parameters', () => {
    const models = parseModelList({
      data: [{ id: 'deepseek/deepseek-chat', supported_parameters: ['temperature', 'reasoning'] }]
    })
    expect(models[0].reasoning).toBe(true)
  })

  it('detects reasoning from a capabilities object', () => {
    const models = parseModelList({
      data: [{ id: 'vendor/model', capabilities: { reasoning: true } }]
    })
    expect(models[0].reasoning).toBe(true)
  })

  it('falls back to the conservative id pattern', () => {
    const ids = [
      'Qwen/Qwen3-235B-A22B-Thinking-2507',
      'deepseek-ai/DeepSeek-R1',
      'openai/o3-mini',
      'openai/gpt-5-mini'
    ].map((id) => parseModelList({ data: [{ id }] })[0])
    expect(ids.every((model) => model.reasoning)).toBe(true)
  })

  it('keeps non-reasoning models off even in the gpt-5 family', () => {
    const ids = ['gpt-4o', 'gpt-5-chat-latest', 'qwen-turbo', 'text-embedding-3-small']
    for (const id of ids) {
      expect(parseModelList({ data: [{ id }] })[0].reasoning).toBe(false)
    }
  })

  it('returns [] for malformed bodies', () => {
    expect(parseModelList(null)).toEqual([])
    expect(parseModelList({})).toEqual([])
    expect(parseModelList({ data: 'nope' })).toEqual([])
    expect(parseModelList({ data: [null, 42, {}, { id: '  ' }] })).toEqual([])
  })
})
