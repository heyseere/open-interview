import { describe, expect, it } from 'vitest'
import { CUSTOM_PRESET_ID, PROVIDER_PRESETS, detectPreset, findPreset } from './providers'

describe('PROVIDER_PRESETS', () => {
  it('has unique ids and always a custom entry', () => {
    const ids = PROVIDER_PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(findPreset(CUSTOM_PRESET_ID)?.baseURL).toBe('')
  })

  it('gives every non-custom preset a resolvable base URL', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.id === CUSTOM_PRESET_ID) continue
      expect(() => new URL(preset.baseURL)).not.toThrow()
    }
  })
})

describe('detectPreset', () => {
  it('matches on host regardless of path and trailing slash', () => {
    expect(detectPreset('https://api.deepseek.com/v1/')?.id).toBe('deepseek')
    expect(detectPreset('https://api.openai.com/v1')?.id).toBe('openai')
    expect(detectPreset('http://localhost:11434/v1')?.id).toBe('ollama')
  })

  it('returns undefined for unknown or malformed URLs', () => {
    expect(detectPreset('https://example.invalid/v1')).toBeUndefined()
    expect(detectPreset('not a url')).toBeUndefined()
    expect(detectPreset('')).toBeUndefined()
  })
})
