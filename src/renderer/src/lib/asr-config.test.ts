import { describe, expect, it } from 'vitest'
import { resolveTranscriptionOptions } from './asr-config'

function baseSettings(overrides: Partial<Parameters<typeof resolveTranscriptionOptions>[0]> = {}) {
  return {
    localAsrModelSize: 'base',
    localAsrLanguage: 'auto',
    chunkSeconds: 5,
    ...overrides
  } as Parameters<typeof resolveTranscriptionOptions>[0]
}

describe('resolveTranscriptionOptions', () => {
  it('always starts and carries the local engine payload', () => {
    expect(resolveTranscriptionOptions(baseSettings())).toEqual({
      ok: true,
      options: { modelSize: 'base', language: 'auto', chunkSeconds: 5 }
    })
  })

  it('passes through the selected model size, language and chunk seconds', () => {
    expect(
      resolveTranscriptionOptions(
        baseSettings({ localAsrModelSize: 'small', localAsrLanguage: 'zh', chunkSeconds: 6 })
      )
    ).toEqual({
      ok: true,
      options: { modelSize: 'small', language: 'zh', chunkSeconds: 6 }
    })
  })
})
