import { create } from 'zustand'

interface FollowUpState {
  isOpen: boolean
  open: () => void
  close: () => void
  setOpen: (open: boolean) => void
}

/**
 * Shared open-state of the follow-up dialog. One dialog instance lives on the
 * coder page; every entry point (hover toolbar, global shortcut) just calls
 * `open()` so they can never fight over separate local states.
 */
export const useFollowUpStore = create<FollowUpState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (open) => set({ isOpen: open })
}))
