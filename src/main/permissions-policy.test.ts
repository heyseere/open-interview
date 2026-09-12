import { describe, expect, it } from 'vitest'
import { canOwnTccPrompt } from './permissions-policy'

describe('canOwnTccPrompt', () => {
  it('lets the packaged macOS app own TCC prompts', () => {
    expect(canOwnTccPrompt(true, 'darwin')).toBe(true)
  })

  it('never prompts from a dev build (would attribute to the terminal)', () => {
    expect(canOwnTccPrompt(false, 'darwin')).toBe(false)
  })

  it('never prompts on non-macOS platforms', () => {
    expect(canOwnTccPrompt(true, 'win32')).toBe(false)
  })
})
