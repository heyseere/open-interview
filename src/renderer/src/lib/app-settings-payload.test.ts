import { describe, expect, it } from 'vitest'
import { toAppSettings } from './app-settings-payload'
import type { ProviderConfig, Settings } from './store/settings'

function provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'p1',
    presetId: 'custom',
    name: 'Provider One',
    kind: 'openai',
    baseURL: 'https://api.example.com/v1',
    apiKey: 'sk-secret',
    models: [],
    modelsBaseURL: '',
    model: 'gpt-5-mini',
    reasoningModelIds: [],
    ...overrides
  }
}

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    providers: [provider()],
    activeProviderId: 'p1',
    reasoningEffort: 'off',
    customPrompt: '',
    screenshotAutoSave: false,
    screenshotDir: '',
    localAsrModelSize: 'base',
    localAsrLanguage: 'auto',
    language: 'zh-CN',
    privacyMode: false,
    audioInputDeviceId: '',
    ...overrides
  } as Settings
}

describe('toAppSettings', () => {
  it('projects the active provider into the flattened main-process fields', () => {
    const payload = toAppSettings(settings())
    expect(payload.providerId).toBe('p1')
    expect(payload.providerKind).toBe('openai')
    expect(payload.apiBaseURL).toBe('https://api.example.com/v1')
    expect(payload.model).toBe('gpt-5-mini')
    expect(payload.language).toBe('zh-CN')
    expect(payload.reasoningEffort).toBe('off')
  })

  it('never carries the API key — credentials go through set-provider-api-key', () => {
    const payload = toAppSettings(settings())
    expect('apiKey' in payload).toBe(false)
  })

  it('carries exactly the fields main reads — renderer-only state stays out', () => {
    const payload = toAppSettings(settings())
    expect(Object.keys(payload).sort()).toEqual(
      [
        'providerId',
        'providerKind',
        'apiBaseURL',
        'model',
        'customPrompt',
        'reasoningEffort',
        'screenshotAutoSave',
        'screenshotDir',
        'localAsrModelSize',
        'localAsrLanguage',
        'language',
        'privacyMode',
        'audioInputDeviceId'
      ].sort()
    )
  })

  it('falls back to blank single-provider fields without a provider', () => {
    const payload = toAppSettings(settings({ providers: [], activeProviderId: 'none' }))
    expect(payload.providerId).toBe('')
    expect(payload.providerKind).toBe('generic')
    expect(payload.apiBaseURL).toBe('')
    expect(payload.model).toBe('')
  })

  it('falls back to the first provider when the active id does not match', () => {
    const payload = toAppSettings(
      settings({
        providers: [provider({ id: 'first' }), provider({ id: 'second', kind: 'deepseek' })],
        activeProviderId: 'missing'
      })
    )
    expect(payload.providerId).toBe('first')
    expect(payload.providerKind).toBe('openai')
  })
})
