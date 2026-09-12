import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import codingPrompt from './prompts/coding.md?raw'
import englishExamPrompt from './prompts/english-exam.md?raw'
import generalQaPrompt from './prompts/general-qa.md?raw'

export interface PromptScene {
  id: string
  name: string
  prompt: string
  isPreset: boolean
}

export type Language = 'zh-CN' | 'en'
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
export const COMPACT_SIZE: WindowSize = { width: 520, height: 520 }

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
    name: '解算法题',
    prompt: PRESET_SCENE_PROMPTS[CODING_SCENE_ID],
    isPreset: true
  },
  {
    id: 'english-exam',
    name: '英语考试',
    prompt: PRESET_SCENE_PROMPTS['english-exam'],
    isPreset: true
  },
  {
    id: 'general-qa',
    name: '通用问答',
    prompt: PRESET_SCENE_PROMPTS['general-qa'],
    isPreset: true
  }
]

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

export const LOCAL_ASR_MODEL_SIZES = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3',
  'large-v3-turbo'
] as const

/** Recognition languages for local whisper.cpp transcription (`-l` flag). */
export const LOCAL_ASR_LANGUAGES = ['auto', 'zh', 'en'] as const

/** Chunk-seconds stepper bounds: 3–15s in 1s steps, default 5s. */
export const CHUNK_SECONDS_MIN = 3
export const CHUNK_SECONDS_MAX = 15
export const CHUNK_SECONDS_STEP = 1
export const CHUNK_SECONDS_DEFAULT = 5

/** Toolbar dwell stepper bounds: 0.2–1s in 0.1s steps, default 0.5s. */
export const TOOLBAR_DWELL_MIN = 200
export const TOOLBAR_DWELL_MAX = 1000
export const TOOLBAR_DWELL_STEP = 100
export const TOOLBAR_DWELL_DEFAULT = 500

/** Snap to the 1s grid and clamp into the 3–15s range. */
export function normalizeChunkSeconds(value: number): number {
  if (!Number.isFinite(value)) return CHUNK_SECONDS_DEFAULT
  const stepped = Math.round(value / CHUNK_SECONDS_STEP) * CHUNK_SECONDS_STEP
  const clamped = Math.min(CHUNK_SECONDS_MAX, Math.max(CHUNK_SECONDS_MIN, stepped))
  return Math.round(clamped * 10) / 10
}

/** Snap to the 0.1s grid (stored in ms) and clamp into the 0.2–1s range. */
export function normalizeToolbarDwellMs(value: number): number {
  if (!Number.isFinite(value)) return TOOLBAR_DWELL_DEFAULT
  const stepped = Math.round(value / TOOLBAR_DWELL_STEP) * TOOLBAR_DWELL_STEP
  return Math.min(TOOLBAR_DWELL_MAX, Math.max(TOOLBAR_DWELL_MIN, stepped))
}
export type LocalAsrModelSize = (typeof LOCAL_ASR_MODEL_SIZES)[number]
export type LocalAsrLanguage = (typeof LOCAL_ASR_LANGUAGES)[number]

export interface Settings {
  // theme: 'light' | 'dark'an
  apiBaseURL: string
  apiKey: string
  model: string
  customModels: string[]
  modelsBaseURL: string // API Base URL that `customModels` was fetched from
  customPrompt: string

  scenes: PromptScene[]
  activeSceneId: string

  opacity: number

  screenshotAutoSave: boolean
  screenshotDir: string

  /** Segment length for the local chunked engine (3–15s stepper) */
  chunkSeconds: number

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

  /** Hover-dwell toolbar on the standard layout */
  toolbarEnabled: boolean
  /** Dwell duration in ms; 0 disables dwell (click-only) */
  toolbarDwellMs: number

  /**
   * Privacy mode: the window is invisible to screen sharing/recording, the
   * macOS dock icon is hidden, and screenshots are never written to disk or
   * previewed. Off by default — toggle it from the header shield button.
   */
  privacyMode: boolean

  audioInputDeviceId: string
}

interface SettingsStore extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  syncSettings: (settings: Partial<Settings>) => void
  setActiveScene: (id: string) => void
  updateScenePrompt: (id: string, prompt: string) => void
  addScene: (name: string) => string
  renameScene: (id: string, name: string) => boolean
  removeScene: (id: string) => void
}

const defaultSettings: Settings = {
  apiBaseURL: '',
  apiKey: '',
  model: '',
  customModels: [],
  modelsBaseURL: '',
  customPrompt: PRESET_SCENE_PROMPTS[CODING_SCENE_ID],
  scenes: createPresetScenes(),
  activeSceneId: CODING_SCENE_ID,

  opacity: 0.8,

  screenshotAutoSave: false,
  screenshotDir: '',
  chunkSeconds: 5,

  localAsrModelSize: 'base',
  localAsrLanguage: 'auto',

  autoSubmitTranscription: false,
  vadSilenceMs: 2000,

  language: 'zh-CN',

  uiLayout: 'standard',
  compactSize: COMPACT_SIZE,

  toolbarEnabled: true,
  toolbarDwellMs: 500,

  privacyMode: false,

  audioInputDeviceId: ''
}

/**
 * Storage v1 (the 1.0.0 "Open Interview" reset). The pre-rebrand store kept a
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

export const SETTINGS_STORAGE_KEY = 'open-interview-settings'
export const SETTINGS_STORAGE_VERSION = 1

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      updateSetting: (key, value) => {
        set({ [key]: value })
      },
      syncSettings: (settings) => {
        set(settings)
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
      // API keys are secrets: persist them encrypted in the main process
      // (Electron safeStorage) instead of plaintext in localStorage.
      partialize: (state) => {
        const { apiKey, ...rest } = state
        void apiKey
        return rest as unknown as SettingsStore
      },
      merge: (persisted, current) => {
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
        return state
      }
    }
  )
)
