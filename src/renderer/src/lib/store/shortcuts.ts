import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { platformAlt } from '../utils/env'
import type { TranslationKey } from '../i18n'

/**
 * Single source of truth for everything every shortcut surface needs to
 * render an action: its label, an optional one-line hint and the category
 * group it belongs to. Every surface (settings recorder, shortcut tip, status
 * bar, help prose) reads this table — never re-declare a local action map.
 */
export interface ShortcutActionMeta {
  labelKey: TranslationKey
  /** Optional short hint shown next to the label in the settings recorder. */
  hintKey?: TranslationKey
  category: ShortcutCategory
}

export const SHORTCUT_CATEGORIES = [
  'windowManagement',
  'screenshotAndAi',
  'navigation',
  'windowMovement'
] as const
export type ShortcutCategory = (typeof SHORTCUT_CATEGORIES)[number]

export const SHORTCUT_CATEGORY_LABEL_KEYS: Record<ShortcutCategory, TranslationKey> = {
  windowManagement: 'shortcuts.windowManagement',
  screenshotAndAi: 'shortcuts.screenshotAndAi',
  navigation: 'shortcuts.navigation',
  windowMovement: 'shortcuts.windowMovement'
}

export const SHORTCUT_ACTION_META: Record<string, ShortcutActionMeta> = {
  hideOrShowMainWindow: {
    labelKey: 'shortcuts.hideOrShow',
    category: 'windowManagement'
  },
  ignoreOrEnableMouse: {
    labelKey: 'shortcuts.mousePassThrough',
    hintKey: 'shortcuts.mousePassThroughDesc',
    category: 'windowManagement'
  },
  toggleMiniMode: {
    labelKey: 'shortcuts.toggleMiniMode',
    category: 'windowManagement'
  },
  opacityUp: {
    labelKey: 'shortcuts.opacityUp',
    category: 'windowManagement'
  },
  opacityDown: {
    labelKey: 'shortcuts.opacityDown',
    category: 'windowManagement'
  },
  takeScreenshot: {
    labelKey: 'shortcuts.takeScreenshot',
    hintKey: 'shortcuts.takeScreenshotDesc',
    category: 'screenshotAndAi'
  },
  appendScreenshot: {
    labelKey: 'shortcuts.appendScreenshot',
    hintKey: 'shortcuts.appendScreenshotDesc',
    category: 'screenshotAndAi'
  },
  captureFullPage: {
    labelKey: 'shortcuts.captureFullPage',
    hintKey: 'shortcuts.captureFullPageDesc',
    category: 'screenshotAndAi'
  },
  stopSolutionStream: {
    labelKey: 'shortcuts.stopGenerating',
    hintKey: 'shortcuts.stopGeneratingDesc',
    category: 'screenshotAndAi'
  },
  followUpQuestion: {
    labelKey: 'shortcuts.followUpQuestion',
    hintKey: 'shortcuts.followUpQuestionDesc',
    category: 'screenshotAndAi'
  },
  toggleTranscription: {
    labelKey: 'shortcuts.toggleTranscription',
    hintKey: 'shortcuts.toggleTranscriptionDesc',
    category: 'screenshotAndAi'
  },
  clearTranscription: {
    labelKey: 'shortcuts.clearTranscription',
    hintKey: 'shortcuts.clearTranscriptionDesc',
    category: 'screenshotAndAi'
  },
  switchScene: {
    labelKey: 'shortcuts.switchScene',
    hintKey: 'shortcuts.switchSceneDesc',
    category: 'screenshotAndAi'
  },
  pageUp: {
    labelKey: 'shortcuts.pageUp',
    category: 'navigation'
  },
  pageDown: {
    labelKey: 'shortcuts.pageDown',
    category: 'navigation'
  },
  moveMainWindowUp: {
    labelKey: 'shortcuts.moveUp',
    category: 'windowMovement'
  },
  moveMainWindowDown: {
    labelKey: 'shortcuts.moveDown',
    category: 'windowMovement'
  },
  moveMainWindowLeft: {
    labelKey: 'shortcuts.moveLeft',
    category: 'windowMovement'
  },
  moveMainWindowRight: {
    labelKey: 'shortcuts.moveRight',
    category: 'windowMovement'
  }
}

export type Shortcut = {
  action: string
  key: string
  defaultKey: string
  category: ShortcutCategory
  status?: ShortcutStatus
}

export enum ShortcutStatus {
  Registered = 'registered',
  Failed = 'failed',
  /** Shortcut is available to register but not registered. */
  Available = 'available'
}

interface ShortcutsState {
  shortcuts: Record<string, Shortcut>
}

/** Registration outcome pushed by the main process (see main/shortcuts.ts). */
export type ShortcutRegistrationMap = Record<string, `${ShortcutStatus}`>

interface ShortcutsStore extends ShortcutsState {
  updateShortcut: (action: string, shortcut: Shortcut) => void
  updateShortcuts: (shortcuts: Record<string, Shortcut>) => void
  resetShortcuts: () => void
  /** Store the main-process registration results (drives the conflict hint). */
  applyRegistration: (report: ShortcutRegistrationMap) => void
}

type PersistedShortcutsState = {
  shortcuts?: Record<string, Shortcut>
}

function isPersistedShortcutsState(value: unknown): value is PersistedShortcutsState {
  return typeof value === 'object' && value !== null && 'shortcuts' in value
}

const defaultShortcuts: Record<string, Omit<Shortcut, 'defaultKey'>> = {
  hideOrShowMainWindow: {
    action: 'hideOrShowMainWindow',
    key: `${platformAlt}+H`,
    category: 'windowManagement'
  },
  ignoreOrEnableMouse: {
    action: 'ignoreOrEnableMouse',
    key: `${platformAlt}+M`,
    category: 'windowManagement'
  },
  toggleMiniMode: {
    action: 'toggleMiniMode',
    key: `${platformAlt}+L`,
    category: 'windowManagement'
  },
  takeScreenshot: {
    action: 'takeScreenshot',
    key: `${platformAlt}+Enter`,
    category: 'screenshotAndAi'
  },
  appendScreenshot: {
    action: 'appendScreenshot',
    key: `${platformAlt}+Shift+Enter`,
    category: 'screenshotAndAi'
  },
  captureFullPage: {
    action: 'captureFullPage',
    key: `${platformAlt}+P`,
    category: 'screenshotAndAi'
  },
  stopSolutionStream: {
    action: 'stopSolutionStream',
    key: `${platformAlt}+.`,
    category: 'screenshotAndAi'
  },
  followUpQuestion: {
    action: 'followUpQuestion',
    key: `${platformAlt}+F`,
    category: 'screenshotAndAi'
  },
  toggleTranscription: {
    action: 'toggleTranscription',
    key: `${platformAlt}+T`,
    category: 'screenshotAndAi'
  },
  clearTranscription: {
    action: 'clearTranscription',
    key: `${platformAlt}+Shift+T`,
    category: 'screenshotAndAi'
  },
  switchScene: {
    action: 'switchScene',
    key: `${platformAlt}+S`,
    category: 'screenshotAndAi'
  },
  opacityUp: {
    action: 'opacityUp',
    key: 'CommandOrControl+]',
    category: 'windowManagement'
  },
  opacityDown: {
    action: 'opacityDown',
    key: 'CommandOrControl+[',
    category: 'windowManagement'
  },
  pageUp: { action: 'pageUp', key: 'CommandOrControl+J', category: 'navigation' },
  pageDown: { action: 'pageDown', key: 'CommandOrControl+K', category: 'navigation' },
  moveMainWindowUp: {
    action: 'moveMainWindowUp',
    key: 'CommandOrControl+Up',
    category: 'windowMovement'
  },
  moveMainWindowDown: {
    action: 'moveMainWindowDown',
    key: 'CommandOrControl+Down',
    category: 'windowMovement'
  },
  moveMainWindowLeft: {
    action: 'moveMainWindowLeft',
    key: 'CommandOrControl+Left',
    category: 'windowMovement'
  },
  moveMainWindowRight: {
    action: 'moveMainWindowRight',
    key: 'CommandOrControl+Right',
    category: 'windowMovement'
  }
}

/**
 * Storage v1 (the "Open Interview" rebrand reset — see settings.ts). The old
 * `interview-coder-shortcuts` key and its v2→v6 migration chain are dropped;
 * the legacy key is wiped on import so stale bindings cannot linger.
 */
try {
  localStorage.removeItem('interview-coder-shortcuts')
} catch {
  // Storage unavailable (tests) — nothing to clean up
}

const SHORTCUTS_STORAGE_KEY = 'open-interview-shortcuts'
const SHORTCUTS_STORAGE_VERSION = 1

function buildDefaultShortcuts(): Record<string, Shortcut> {
  return Object.fromEntries(
    Object.entries(defaultShortcuts).map(([action, shortcut]) => [
      action,
      { ...shortcut, defaultKey: shortcut.key }
    ])
  )
}

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set) => ({
      shortcuts: buildDefaultShortcuts(),
      updateShortcut: (action, shortcut) => {
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [action]: shortcut
          }
        }))
      },
      updateShortcuts: (shortcuts) => {
        set({ shortcuts })
      },
      resetShortcuts: () => {
        set({ shortcuts: buildDefaultShortcuts() })
      },
      applyRegistration: (report) => {
        set((state) => {
          let changed = false
          const shortcuts = { ...state.shortcuts }
          for (const [action, status] of Object.entries(report)) {
            const shortcut = shortcuts[action]
            if (!shortcut || shortcut.status === status) continue
            shortcuts[action] = { ...shortcut, status: status as ShortcutStatus }
            changed = true
          }
          return changed ? { shortcuts } : {}
        })
      }
    }),
    {
      name: SHORTCUTS_STORAGE_KEY,
      version: SHORTCUTS_STORAGE_VERSION,
      // Fold persisted bindings over the defaults so shortcuts added in
      // future versions appear for existing users.
      merge: (persisted, current) => {
        if (!isPersistedShortcutsState(persisted) || !persisted.shortcuts) return current
        return {
          ...current,
          shortcuts: { ...current.shortcuts, ...persisted.shortcuts }
        }
      }
    }
  )
)
