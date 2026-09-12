import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { platformAlt } from '../utils/env'

export type Shortcut = {
  action: string
  key: string
  defaultKey: string
  category: string
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

interface ShortcutsStore extends ShortcutsState {
  updateShortcut: (action: string, shortcut: Shortcut) => void
  updateShortcuts: (shortcuts: Record<string, Shortcut>) => void
  resetShortcuts: () => void
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
    category: 'Window Management'
  },
  ignoreOrEnableMouse: {
    action: 'ignoreOrEnableMouse',
    key: `${platformAlt}+M`,
    category: 'Window Management'
  },
  toggleMiniMode: {
    action: 'toggleMiniMode',
    key: `${platformAlt}+L`,
    category: 'Window Management'
  },
  takeScreenshot: {
    action: 'takeScreenshot',
    key: `${platformAlt}+Enter`,
    category: 'Screenshot & AI'
  },
  appendScreenshot: {
    action: 'appendScreenshot',
    key: `${platformAlt}+Shift+Enter`,
    category: 'Screenshot & AI'
  },
  stopSolutionStream: {
    action: 'stopSolutionStream',
    key: `${platformAlt}+.`,
    category: 'Screenshot & AI'
  },
  followUpQuestion: {
    action: 'followUpQuestion',
    key: `${platformAlt}+F`,
    category: 'Screenshot & AI'
  },
  toggleTranscription: {
    action: 'toggleTranscription',
    key: `${platformAlt}+T`,
    category: 'Screenshot & AI'
  },
  clearTranscription: {
    action: 'clearTranscription',
    key: `${platformAlt}+Shift+T`,
    category: 'Screenshot & AI'
  },
  pageUp: { action: 'pageUp', key: 'CommandOrControl+J', category: 'Navigation' },
  pageDown: { action: 'pageDown', key: 'CommandOrControl+K', category: 'Navigation' },
  moveMainWindowUp: {
    action: 'moveMainWindowUp',
    key: 'CommandOrControl+Up',
    category: 'Window Movement'
  },
  moveMainWindowDown: {
    action: 'moveMainWindowDown',
    key: 'CommandOrControl+Down',
    category: 'Window Movement'
  },
  moveMainWindowLeft: {
    action: 'moveMainWindowLeft',
    key: 'CommandOrControl+Left',
    category: 'Window Movement'
  },
  moveMainWindowRight: {
    action: 'moveMainWindowRight',
    key: 'CommandOrControl+Right',
    category: 'Window Movement'
  }
}

/**
 * Storage v1 (the 1.0.0 "Open Interview" reset — see settings.ts). The old
 * `interview-coder-shortcuts` key and its v2→v6 migration chain are dropped;
 * the legacy key is wiped on import so stale bindings cannot linger.
 */
try {
  localStorage.removeItem('interview-coder-shortcuts')
} catch {
  // Storage unavailable (tests) — nothing to clean up
}

export const SHORTCUTS_STORAGE_KEY = 'open-interview-shortcuts'
export const SHORTCUTS_STORAGE_VERSION = 1

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
