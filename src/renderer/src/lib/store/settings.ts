import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  LOCAL_ASR_LANGUAGES,
  LOCAL_ASR_SIZES,
  type LocalAsrLanguage,
  type LocalAsrModelSize
} from '@shared/asr'
import type { Language } from '@shared/i18n'
import { REASONING_EFFORTS, type ReasoningEffort } from '@shared/providers'
import codingPrompt from './prompts/coding.md?raw'
import englishExamPrompt from './prompts/english-exam.md?raw'
import generalQaPrompt from './prompts/general-qa.md?raw'
import {
  TOOLBAR_BUTTON_DEFAULT,
  normalizeToolbarButtons,
  type ToolbarButtonId
} from '../toolbar-buttons'
import {
  CUSTOM_PRESET_ID,
  PROVIDER_PRESETS,
  detectPreset,
  findPreset,
  type ProviderKind
} from '../providers'
import type { TranslationKey } from '../i18n'

export interface PromptScene {
  id: string
  name: string
  prompt: string
  isPreset: boolean
}

// UI language — the vocabulary lives in @shared/i18n (main + renderer share
// it); re-exported for the surfaces that read it from the settings store.
export type { Language }
export type UiLayout = 'standard' | 'compact'

export interface WindowSize {
  width: number
  height: number
}

/** Default standard-layout window size (mirrors main-window.ts) */
export const STANDARD_WINDOW_SIZE: WindowSize = { width: 900, height: 670 }

/**
 * Compact layout: ONE square panel (code-style answers read naturally),
 * user-resizable via the bottom-right grip and persisted as a single size.
 */
const COMPACT_SIZE: WindowSize = { width: 520, height: 520 }

/** Minimum compact panel size (drag-resize lower bound; the panel stays square). */
export const COMPACT_MIN_SIZE: WindowSize = { width: 320, height: 320 }

export const CODING_SCENE_ID = 'coding'

/** Default prompts for all preset scenes, maintained as Markdown files under ./prompts */
export const PRESET_SCENE_PROMPTS: Record<string, string> = {
  [CODING_SCENE_ID]: codingPrompt,
  'english-exam': englishExamPrompt,
  'general-qa': generalQaPrompt
}

const createPresetScenes = (): PromptScene[] => [
  {
    id: CODING_SCENE_ID,
    name: 'Coding',
    prompt: PRESET_SCENE_PROMPTS[CODING_SCENE_ID],
    isPreset: true
  },
  {
    id: 'english-exam',
    name: 'English exam',
    prompt: PRESET_SCENE_PROMPTS['english-exam'],
    isPreset: true
  },
  {
    id: 'general-qa',
    name: 'General Q&A',
    prompt: PRESET_SCENE_PROMPTS['general-qa'],
    isPreset: true
  }
]

/**
 * Translated labels for the preset scene ids. Preset scenes keep a stable
 * fallback `name` (older saved settings carry the literal Chinese name), so
 * display goes through sceneDisplayName instead of reading scene.name.
 */
const PRESET_SCENE_NAME_KEYS: Partial<Record<string, TranslationKey>> = {
  [CODING_SCENE_ID]: 'scene.coding',
  'english-exam': 'scene.english-exam',
  'general-qa': 'scene.general-qa'
}

/** Scene display name: preset ids get their translated label, customs their typed name. */
export function sceneDisplayName(
  scene: Pick<PromptScene, 'id' | 'name' | 'isPreset'>,
  t: (key: TranslationKey) => string
): string {
  if (!scene.isPreset) return scene.name
  const key = PRESET_SCENE_NAME_KEYS[scene.id]
  return key ? t(key) : scene.name
}

/** Derive the `customPrompt` (the system prompt used by the main process) from the active scene */
function composeCustomPrompt(scenes: PromptScene[], activeSceneId: string): string {
  const scene = scenes.find((s) => s.id === activeSceneId)
  if (!scene) return PRESET_SCENE_PROMPTS[CODING_SCENE_ID]
  // An emptied preset scene falls back to its default prompt
  return scene.prompt.trim() || PRESET_SCENE_PROMPTS[scene.id] || ''
}

function normalizeSceneName(name: string): string {
  return name.trim()
}

function isSceneNameAvailable(scenes: PromptScene[], name: string, ignoredId?: string): boolean {
  const normalized = normalizeSceneName(name)
  return (
    Boolean(normalized) &&
    !scenes.some((scene) => scene.id !== ignoredId && scene.name === normalized)
  )
}

// Local ASR vocabulary lives in @shared/asr (one list shared by main and
// renderer); re-exported under the store's historical names for the settings UI.
export { LOCAL_ASR_SIZES as LOCAL_ASR_MODEL_SIZES, LOCAL_ASR_LANGUAGES }

/** Answer text sizes in px for the markdown answer and the compact panel. */
export const ANSWER_FONT_SIZES = { small: 12.5, medium: 14, large: 16 } as const
export type AnswerFontSize = keyof typeof ANSWER_FONT_SIZES
export const ANSWER_FONT_DEFAULT: AnswerFontSize = 'medium'

/** Reasoning (deep-thinking) effort levels; 'off' sends no reasoning param.
 * The vocabulary lives in @shared/providers (main's zod schema reads the same
 * lists); re-exported for the settings UI. */
export { REASONING_EFFORTS, type ReasoningEffort }
const REASONING_EFFORT_DEFAULT: ReasoningEffort = 'off'

/** Toolbar dwell stepper bounds: 0.2–1s in 0.1s steps, default 0.5s. */
export const TOOLBAR_DWELL_MIN = 200
export const TOOLBAR_DWELL_MAX = 1000
export const TOOLBAR_DWELL_STEP = 100
export const TOOLBAR_DWELL_DEFAULT = 500

/** Snap to the 0.1s grid (stored in ms) and clamp into the 0.2–1s range. */
export function normalizeToolbarDwellMs(value: number): number {
  if (!Number.isFinite(value)) return TOOLBAR_DWELL_DEFAULT
  const stepped = Math.round(value / TOOLBAR_DWELL_STEP) * TOOLBAR_DWELL_STEP
  return Math.min(TOOLBAR_DWELL_MAX, Math.max(TOOLBAR_DWELL_MIN, stepped))
}
export type { LocalAsrLanguage, LocalAsrModelSize }

/**
 * One configured model provider. The app speaks the OpenAI-compatible chat
 * completions protocol to every provider; `kind` additionally selects the
 * provider-native thinking fields injected by the main process
 * (src/main/reasoning-body.ts).
 *
 * `apiKey` is a SECRET and is stripped from localStorage by `partialize`;
 * it is persisted encrypted in the main process keyed by `id`.
 */
export interface ProviderConfig {
  id: string
  /** Preset this provider was created from (`custom` for blank ones). */
  presetId: string
  name: string
  kind: ProviderKind
  baseURL: string
  apiKey: string
  /** Suggested models (preset defaults) merged with the fetched `/models` list. */
  models: string[]
  /** Base URL the current `models` list came from (staleness check). */
  modelsBaseURL: string
  model: string
  /** Subset of models whose detail metadata reports reasoning/thinking support. */
  reasoningModelIds: string[]
}

export interface Settings {
  providers: ProviderConfig[]
  activeProviderId: string

  /**
   * User's deep-thinking effort preference. It is ALWAYS selectable — the
   * model-list detection only powers a hint, never a lock, because most
   * providers publish no reasoning metadata at all.
   */
  reasoningEffort: ReasoningEffort
  customPrompt: string

  scenes: PromptScene[]
  activeSceneId: string

  opacity: number

  /** Answer text size (markdown answer + compact panel), applied as a CSS variable */
  answerFontSize: AnswerFontSize

  screenshotAutoSave: boolean
  screenshotDir: string

  /** Local whisper.cpp model size */
  localAsrModelSize: LocalAsrModelSize
  /** Recognition language for local whisper.cpp transcription */
  localAsrLanguage: LocalAsrLanguage
  /** Auto-submit transcription after sustained silence (VAD) */
  autoSubmitTranscription: boolean
  /** Silence duration in ms before auto-submit fires */
  vadSilenceMs: number

  /** UI language */
  language: Language

  /**
   * Window layout: full UI, or the single compact panel. Standard ↔ compact
   * is one switch (shortcut Alt+L / header button).
   */
  uiLayout: UiLayout
  /** Compact panel size (square, for code answers) */
  compactSize: WindowSize

  /** Hover-dwell toolbar (standard AND compact layouts) */
  toolbarEnabled: boolean
  /** Hover-dwell auto trigger; off = buttons react to clicks only */
  toolbarHoverTrigger: boolean
  /** Dwell duration in ms; 0 disables dwell (click-only) */
  toolbarDwellMs: number
  /** Buttons shown in the toolbar, in the user's chosen order */
  toolbarButtons: ToolbarButtonId[]

  /**
   * Privacy mode: the window is invisible to screen sharing/recording, the
   * macOS dock icon is hidden, and screenshots are never written to disk.
   * The in-app preview still works (the user needs to check the capture).
   * Off by default — toggle it from the header shield button.
   */
  privacyMode: boolean

  audioInputDeviceId: string
}

interface SettingsStore extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  setActiveScene: (id: string) => void
  updateScenePrompt: (id: string, prompt: string) => void
  addScene: (name: string) => string
  renameScene: (id: string, name: string) => boolean
  removeScene: (id: string) => void
  /** Switch the provider that every AI request uses. */
  setActiveProvider: (id: string) => void
  addProvider: (provider: ProviderConfig) => void
  updateProvider: (id: string, patch: Partial<Omit<ProviderConfig, 'id'>>) => void
  removeProvider: (id: string) => void
}

/** Provider id for the provider created by migration / first run. */
const DEFAULT_PROVIDER_ID = 'default'

/** Build a provider from a preset (or a blank one for `custom`). */
export function createProvider(presetId: string, name?: string): ProviderConfig {
  const preset = findPreset(presetId)
  return {
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    presetId: preset?.id ?? CUSTOM_PRESET_ID,
    name: name?.trim() || preset?.name || 'Provider',
    kind: preset?.kind ?? 'generic',
    baseURL: preset?.baseURL ?? '',
    apiKey: '',
    models: preset?.models ?? [],
    modelsBaseURL: '',
    model: '',
    reasoningModelIds: []
  }
}

/**
 * The provider every request uses. Falls back to the first configured one so
 * a stale/removed `activeProviderId` can never leave the app with no target.
 */
export function activeProviderOf(
  state: Pick<Settings, 'providers' | 'activeProviderId'>
): ProviderConfig | undefined {
  return (
    state.providers.find((provider) => provider.id === state.activeProviderId) ?? state.providers[0]
  )
}

const defaultSettings: Settings = {
  providers: [
    {
      id: DEFAULT_PROVIDER_ID,
      presetId: CUSTOM_PRESET_ID,
      name: PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1].name,
      kind: 'generic',
      baseURL: '',
      apiKey: '',
      models: [],
      modelsBaseURL: '',
      model: '',
      reasoningModelIds: []
    }
  ],
  activeProviderId: DEFAULT_PROVIDER_ID,
  reasoningEffort: REASONING_EFFORT_DEFAULT,
  customPrompt: PRESET_SCENE_PROMPTS[CODING_SCENE_ID],
  scenes: createPresetScenes(),
  activeSceneId: CODING_SCENE_ID,

  opacity: 0.8,

  answerFontSize: ANSWER_FONT_DEFAULT,

  screenshotAutoSave: false,
  screenshotDir: '',

  localAsrModelSize: 'base',
  localAsrLanguage: 'auto',

  autoSubmitTranscription: false,
  vadSilenceMs: 2000,

  language: 'zh-CN',

  uiLayout: 'standard',
  compactSize: COMPACT_SIZE,

  toolbarEnabled: true,
  toolbarHoverTrigger: true,
  toolbarDwellMs: 500,
  toolbarButtons: TOOLBAR_BUTTON_DEFAULT,

  privacyMode: false,

  audioInputDeviceId: ''
}

/**
 * Storage v1 (the "Open Interview" rebrand reset). The pre-rebrand store kept a
 * v8→v15 migration chain under the old `interview-coder-*` localStorage keys;
 * the rebrand starts fresh under new keys and drops that chain entirely. The
 * old keys are wiped below so stale data cannot linger in the renderer
 * storage.
 */
const LEGACY_STORAGE_KEYS = ['interview-coder-settings', 'interview-coder-shortcuts']
for (const key of LEGACY_STORAGE_KEYS) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage unavailable (tests) — nothing to clean up
  }
}

const SETTINGS_STORAGE_KEY = 'open-interview-settings'
const SETTINGS_STORAGE_VERSION = 1

/** Store methods — never persisted, they are closures over `set`/`get`. */
const STORE_ACTION_KEYS = [
  'updateSetting',
  'setActiveScene',
  'updateScenePrompt',
  'addScene',
  'renameScene',
  'removeScene',
  'setActiveProvider',
  'addProvider',
  'updateProvider',
  'removeProvider'
] as const

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      updateSetting: (key, value) => {
        set({ [key]: value })
      },
      setActiveProvider: (id) => {
        set((state) =>
          state.providers.some((provider) => provider.id === id) ? { activeProviderId: id } : state
        )
      },
      addProvider: (provider) => {
        set((state) => ({
          providers: [...state.providers, provider],
          activeProviderId: provider.id
        }))
      },
      updateProvider: (id, patch) => {
        set((state) => ({
          providers: state.providers.map((provider) =>
            provider.id === id ? { ...provider, ...patch } : provider
          )
        }))
      },
      removeProvider: (id) => {
        set((state) => {
          const providers = state.providers.filter((provider) => provider.id !== id)
          if (providers.length === 0) return state
          return {
            providers,
            activeProviderId:
              state.activeProviderId === id ? providers[0].id : state.activeProviderId
          }
        })
      },
      setActiveScene: (id) => {
        set((state) => ({
          activeSceneId: id,
          customPrompt: composeCustomPrompt(state.scenes, id)
        }))
      },
      updateScenePrompt: (id, prompt) => {
        set((state) => {
          const scenes = state.scenes.map((s) => (s.id === id ? { ...s, prompt } : s))
          return {
            scenes,
            customPrompt: composeCustomPrompt(scenes, state.activeSceneId)
          }
        })
      },
      addScene: (name) => {
        const normalizedName = normalizeSceneName(name)
        if (!isSceneNameAvailable(get().scenes, normalizedName)) return ''
        const id = `custom-${Date.now()}`
        set((state) => {
          const scenes = [
            ...state.scenes,
            { id, name: normalizedName, prompt: '', isPreset: false }
          ]
          return {
            scenes,
            activeSceneId: id,
            customPrompt: composeCustomPrompt(scenes, id)
          }
        })
        return id
      },
      renameScene: (id, name) => {
        const normalizedName = normalizeSceneName(name)
        const scene = get().scenes.find((item) => item.id === id)
        if (!scene || scene.isPreset || !isSceneNameAvailable(get().scenes, normalizedName, id)) {
          return false
        }
        set((state) => ({
          scenes: state.scenes.map((item) =>
            item.id === id ? { ...item, name: normalizedName } : item
          )
        }))
        return true
      },
      removeScene: (id) => {
        const scene = get().scenes.find((s) => s.id === id)
        if (!scene || scene.isPreset) return
        set((state) => {
          const scenes = state.scenes.filter((s) => s.id !== id)
          const activeSceneId = state.activeSceneId === id ? CODING_SCENE_ID : state.activeSceneId
          return {
            scenes,
            activeSceneId,
            customPrompt: composeCustomPrompt(scenes, activeSceneId)
          }
        })
      }
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: SETTINGS_STORAGE_VERSION,
      // Provider API keys are secrets: they are persisted encrypted in the
      // main process (safeStorage, keyed by provider id) instead of plaintext
      // in localStorage. Persist data fields only (never the action closures).
      partialize: (state) => {
        const data: Record<string, unknown> = { ...state }
        for (const key of STORE_ACTION_KEYS) delete data[key]
        data.providers = state.providers.map((provider) => ({ ...provider, apiKey: '' }))
        return data as unknown as SettingsStore
      },
      // Fold persisted bindings over the defaults; see mergePersistedSettings.
      merge: mergePersistedSettings
    }
  )
)

/**
 * Rebuild the provider list from persisted state.
 *
 * Legacy stores (≤ v1) carried a single flat provider (`apiBaseURL`/`apiKey`/
 * `model`/`customModels`/`reasoningModelIds`); those are folded into the first
 * provider so upgrading never loses the configured endpoint or model. The
 * check must look at the PERSISTED object, not the merged state — the merged
 * state always carries the default provider from `defaultSettings`.
 */
function normalizeProviders(persisted: unknown): ProviderConfig[] {
  const record = (persisted ?? {}) as Record<string, unknown>
  const stored = record.providers
  if (Array.isArray(stored) && stored.length > 0) {
    return (stored as ProviderConfig[]).map((provider) => ({
      ...provider,
      kind: provider.kind ?? 'generic',
      models: Array.isArray(provider.models) ? provider.models : [],
      reasoningModelIds: Array.isArray(provider.reasoningModelIds)
        ? provider.reasoningModelIds
        : [],
      // Keys live encrypted in the main process; merged back in by App.tsx
      apiKey: typeof provider.apiKey === 'string' ? provider.apiKey : ''
    }))
  }

  const baseURL = typeof record.apiBaseURL === 'string' ? record.apiBaseURL : ''
  const preset = detectPreset(baseURL) ?? findPreset(CUSTOM_PRESET_ID)
  const legacyModels = Array.isArray(record.customModels)
    ? record.customModels.filter((id): id is string => typeof id === 'string')
    : []
  const migrated: ProviderConfig = {
    id: DEFAULT_PROVIDER_ID,
    presetId: preset?.id ?? CUSTOM_PRESET_ID,
    name: baseURL ? (preset?.name ?? baseURL) : 'Provider',
    kind: preset?.kind ?? 'generic',
    baseURL,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
    models: Array.from(new Set([...(preset?.models ?? []), ...legacyModels])),
    modelsBaseURL: typeof record.modelsBaseURL === 'string' ? record.modelsBaseURL : '',
    model: typeof record.model === 'string' ? record.model : '',
    reasoningModelIds: Array.isArray(record.reasoningModelIds)
      ? record.reasoningModelIds.filter((id): id is string => typeof id === 'string')
      : []
  }
  return [migrated]
}

/**
 * Fold persisted settings over the defaults (the persist middleware's
 * `merge`). Preset scenes always exist — user-edited prompts are kept, and a
 * preset scene left empty falls back to its default prompt — so presets added
 * in future versions show up for existing users. Stale scene/provider
 * pointers fall back to the first entry. Exported pure so the rules stay
 * unit-testable without localStorage.
 */
export function mergePersistedSettings(persisted: unknown, current: SettingsStore): SettingsStore {
  const state = { ...current, ...(persisted as Partial<Settings>) }
  // Ensure preset scenes always exist (keep user-edited prompts),
  // so presets added in future versions show up for existing users
  const persistedScenes = Array.isArray(state.scenes) ? state.scenes : []
  state.scenes = [
    ...createPresetScenes().map((p) => {
      const saved = persistedScenes.find((s) => s.id === p.id)
      // Restore the default prompt if a preset scene was left empty
      return saved?.prompt.trim() ? saved : p
    }),
    ...persistedScenes.filter((s) => !s.isPreset)
  ]
  if (!state.scenes.some((s) => s.id === state.activeSceneId)) {
    state.activeSceneId = CODING_SCENE_ID
  }
  state.customPrompt = composeCustomPrompt(state.scenes, state.activeSceneId)
  state.providers = normalizeProviders(persisted)
  state.toolbarButtons = normalizeToolbarButtons(state.toolbarButtons)
  if (!state.providers.some((provider) => provider.id === state.activeProviderId)) {
    state.activeProviderId = state.providers[0].id
  }
  return state
}
