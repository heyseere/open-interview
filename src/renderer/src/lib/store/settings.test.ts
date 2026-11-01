import { describe, expect, it } from 'vitest'
import {
  mergePersistedSettings,
  normalizeToolbarDwellMs,
  TOOLBAR_DWELL_DEFAULT,
  useSettingsStore
} from './settings'

/**
 * Storage is v1 since the 1.0.0 "Open Interview" reset (new localStorage
 * keys, no migration chain) — the persisted pieces stay pure and unit-tested:
 * the dwell stepper normalizer below and the persist `merge` fold.
 */
describe('normalizeToolbarDwellMs', () => {
  it('snaps to the 0.1s grid', () => {
    expect(normalizeToolbarDwellMs(460)).toBe(500)
    expect(normalizeToolbarDwellMs(240)).toBe(200)
  })

  it('clamps into the 0.2–1s range', () => {
    expect(normalizeToolbarDwellMs(0)).toBe(200)
    expect(normalizeToolbarDwellMs(2000)).toBe(1000)
  })

  it('falls back to the default for non-finite values', () => {
    expect(normalizeToolbarDwellMs(Number.NaN)).toBe(TOOLBAR_DWELL_DEFAULT)
  })
})

describe('mergePersistedSettings (persist merge)', () => {
  // The store's initial state doubles as the `current` the persist middleware
  // passes: defaults plus the action closures the merge must carry through.
  const current = useSettingsStore.getInitialState()

  it('keeps the defaults when nothing was persisted', () => {
    const merged = mergePersistedSettings(null, current)
    expect(merged.scenes.map((s) => s.id)).toEqual(['coding', 'english-exam', 'general-qa'])
    expect(merged.activeSceneId).toBe('coding')
    // No provider list to restore → the legacy-flat rebuild still lands on
    // exactly one default provider (name differs from the store's initial one)
    expect(merged.providers).toHaveLength(1)
    expect(merged.providers[0].id).toBe('default')
    expect(merged.activeProviderId).toBe('default')
  })

  it('keeps user-edited prompts and re-adds missing preset scenes', () => {
    const merged = mergePersistedSettings(
      {
        scenes: [
          { id: 'coding', name: 'Coding', prompt: 'my prompt', isPreset: true },
          { id: 'custom-1', name: 'Mine', prompt: 'hello', isPreset: false }
        ],
        activeSceneId: 'custom-1'
      },
      current
    )
    expect(merged.scenes.map((s) => s.id)).toEqual([
      'coding',
      'english-exam',
      'general-qa',
      'custom-1'
    ])
    expect(merged.scenes.find((s) => s.id === 'coding')?.prompt).toBe('my prompt')
    expect(merged.customPrompt).toBe('hello')
  })

  it('restores the default prompt for an emptied preset scene', () => {
    const merged = mergePersistedSettings(
      { scenes: [{ id: 'coding', name: 'Coding', prompt: '   ', isPreset: true }] },
      current
    )
    const defaultPrompt = current.scenes.find((s) => s.id === 'coding')?.prompt
    expect(merged.scenes.find((s) => s.id === 'coding')?.prompt).toBe(defaultPrompt)
    expect(merged.customPrompt).toBe(defaultPrompt)
  })

  it('falls back to the coding scene when the active scene is gone', () => {
    const merged = mergePersistedSettings(
      {
        scenes: [{ id: 'custom-x', name: 'X', prompt: 'x', isPreset: false }],
        activeSceneId: 'deleted-scene'
      },
      current
    )
    expect(merged.activeSceneId).toBe('coding')
    expect(merged.customPrompt).toBe(current.scenes.find((s) => s.id === 'coding')?.prompt)
  })

  it('falls back to the first provider when the active one is gone', () => {
    const merged = mergePersistedSettings(
      {
        providers: [
          { id: 'a', kind: 'openai', models: [], reasoningModelIds: [], apiKey: '' },
          { id: 'b', kind: 'generic', models: [], reasoningModelIds: [], apiKey: '' }
        ],
        activeProviderId: 'removed'
      },
      current
    )
    expect(merged.providers.map((p) => p.id)).toEqual(['a', 'b'])
    expect(merged.activeProviderId).toBe('a')
  })

  it.each([
    ['no provider list', undefined],
    ['an empty provider list', []]
  ])('%s rebuilds the migrated default provider', (_label, providers) => {
    const merged = mergePersistedSettings({ providers }, current)
    expect(merged.providers).toHaveLength(1)
    expect(merged.providers[0].id).toBe('default')
    expect(merged.activeProviderId).toBe('default')
  })

  it('folds the legacy flat store (≤ v1) into one migrated provider', () => {
    const merged = mergePersistedSettings(
      {
        apiBaseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        customModels: ['deepseek-reasoner']
      },
      current
    )
    expect(merged.providers).toHaveLength(1)
    expect(merged.providers[0].presetId).toBe('deepseek')
    // Preset suggestions and the legacy custom models both survive
    expect(merged.providers[0].models).toEqual(
      expect.arrayContaining(['deepseek-chat', 'deepseek-reasoner'])
    )
  })

  it('normalizes ragged provider records', () => {
    const merged = mergePersistedSettings(
      {
        providers: [
          {
            id: 'p1',
            name: 'P1',
            // missing kind / models / reasoningModelIds / apiKey
            baseURL: 'https://example.com/v1'
          }
        ]
      },
      current
    )
    expect(merged.providers[0]).toMatchObject({
      kind: 'generic',
      models: [],
      reasoningModelIds: [],
      apiKey: ''
    })
  })
})
