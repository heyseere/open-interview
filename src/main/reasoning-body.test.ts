import { describe, expect, it } from 'vitest'
import { thinkingBody, usesGenericReasoningEffort } from './reasoning-body'

describe('thinkingBody', () => {
  it('returns nothing for kinds without a native switch', () => {
    expect(thinkingBody({ kind: 'openai', effort: 'high', model: 'gpt-5' })).toEqual({})
    expect(thinkingBody({ kind: 'generic', effort: 'high', model: 'x' })).toEqual({})
  })

  it('sends DeepSeek thinking on with a mapped effort', () => {
    expect(thinkingBody({ kind: 'deepseek', effort: 'low', model: 'deepseek-reasoner' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'low'
    })
    // DeepSeek has no `medium`: map it onto high rather than dropping it
    expect(thinkingBody({ kind: 'deepseek', effort: 'medium', model: 'deepseek-chat' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    })
    expect(thinkingBody({ kind: 'deepseek', effort: 'high', model: 'deepseek-chat' })).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high'
    })
  })

  it('explicitly disables DeepSeek thinking when off', () => {
    // DeepSeek defaults thinking ON, so omitting the field would leave it on
    expect(thinkingBody({ kind: 'deepseek', effort: 'off', model: 'deepseek-chat' })).toEqual({
      thinking: { type: 'disabled' }
    })
  })

  it('uses enable_thinking for Qwen and a type toggle for 智谱', () => {
    expect(thinkingBody({ kind: 'qwen', effort: 'high', model: 'qwen3-max' })).toEqual({
      enable_thinking: true
    })
    expect(thinkingBody({ kind: 'qwen', effort: 'off', model: 'qwen3-max' })).toEqual({
      enable_thinking: false
    })
    expect(thinkingBody({ kind: 'zhipu', effort: 'medium', model: 'glm-4.6' })).toEqual({
      thinking: { type: 'enabled' }
    })
    expect(thinkingBody({ kind: 'zhipu', effort: 'off', model: 'glm-4.6' })).toEqual({
      thinking: { type: 'disabled' }
    })
  })
})

describe('usesGenericReasoningEffort', () => {
  it('is true exactly for openai and generic kinds', () => {
    expect(usesGenericReasoningEffort('openai')).toBe(true)
    expect(usesGenericReasoningEffort('generic')).toBe(true)
    expect(usesGenericReasoningEffort('deepseek')).toBe(false)
    expect(usesGenericReasoningEffort('qwen')).toBe(false)
    expect(usesGenericReasoningEffort('zhipu')).toBe(false)
  })
})
