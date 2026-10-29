import { describe, expect, it } from 'vitest'
import { resolveTranscriptionOptions } from './asr-config'

function baseSettings(overrides: Partial<Parameters<typeof resolveTranscriptionOptions>[0]> = {}) {
  return {
    localAsrModelSize: 'base',
    localAsrLanguage: 'auto',
    ...overrides
  } as Parameters<typeof resolveTranscriptionOptions>[0]
}

describe('resolveTranscriptionOptions', () => {
  it('always starts and carries the local engine payload', () => {
    expect(resolveTranscriptionOptions(baseSettings())).toEqual({
      options: { modelSize: 'base', language: 'auto' }
    })
  })

  it('passes through the selected model size and language', () => {
    expect(
      resolveTranscriptionOptions(
        baseSettings({ localAsrModelSize: 'small', localAsrLanguage: 'zh' })
      )
    ).toEqual({
      options: { modelSize: 'small', language: 'zh' }
    })
  })
})
