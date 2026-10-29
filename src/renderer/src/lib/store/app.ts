import { create } from 'zustand'

/**
 * Window state mirrored from main. Two passthrough fields on purpose:
 * - `passthrough` is the USER'S INTENT — what the header icon and the toggle
 *   read. It stays true while a hover lift makes the window temporarily
 *   clickable.
 * - `ignoreMouse` is the EFFECTIVE value. It flips to false every time the
 *   hover coordinator lifts an overlay, so it is never a valid "is the mode
 *   on?" answer.
 * Reading `ignoreMouse` for UI state was the original toggle bug: while the
 * pointer hovered the header the icon reported "off" and pressing it re-armed
 * passthrough instead of disabling it.
 */
interface AppState {
  inCoderPage: boolean
  passthrough: boolean
  ignoreMouse: boolean
}

interface AppStore extends AppState {
  setIgnoreMouse: (ignore: boolean) => void
  syncAppState: (state: AppState) => void
}

const defaultState: AppState = {
  inCoderPage: false,
  passthrough: false,
  ignoreMouse: false
}

export const useAppStore = create<AppStore>()((set) => ({
  ...defaultState,
  setIgnoreMouse: (ignore) => {
    set({ ignoreMouse: ignore })
  },
  syncAppState: (state) => {
    set(state)
  }
}))
