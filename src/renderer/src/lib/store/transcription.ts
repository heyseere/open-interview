import { create } from 'zustand'

interface TranscriptionState {
  isTranscribing: boolean
  /** Committed (final) transcript. */
  transcriptionText: string
  /** Uncommitted tail of the current recognition window. */
  partialText: string
}

interface TranscriptionStore extends TranscriptionState {
  setIsTranscribing: (v: boolean) => void
  setTranscriptionText: (text: string) => void
  setPartialText: (text: string) => void
  clearText: () => void
  resetState: () => void
}

const defaultState: TranscriptionState = {
  isTranscribing: false,
  transcriptionText: '',
  partialText: ''
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => ({
  ...defaultState,
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscriptionText: (text) => set({ transcriptionText: text }),
  setPartialText: (text) => set({ partialText: text }),
  clearText: () => set({ transcriptionText: '', partialText: '' }),
  resetState: () => set(defaultState)
}))
