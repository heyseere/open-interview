import { create } from 'zustand'

/** The local chunked engine reports segment progress. */
export interface TranscriptionProgress {
  processed: number
  queued: number
}

interface TranscriptionState {
  isTranscribing: boolean
  transcriptionText: string
  errorMessage: string | null
  progress: TranscriptionProgress | null
}

interface TranscriptionStore extends TranscriptionState {
  setIsTranscribing: (v: boolean) => void
  setTranscriptionText: (text: string) => void
  clearText: () => void
  setError: (msg: string | null) => void
  setProgress: (p: TranscriptionProgress | null) => void
  resetState: () => void
}

const defaultState: TranscriptionState = {
  isTranscribing: false,
  transcriptionText: '',
  errorMessage: null,
  progress: null
}

export const useTranscriptionStore = create<TranscriptionStore>()((set) => ({
  ...defaultState,
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscriptionText: (text) => set({ transcriptionText: text }),
  clearText: () => set({ transcriptionText: '' }),
  setError: (msg) => set({ errorMessage: msg }),
  setProgress: (progress) => set({ progress }),
  resetState: () => set(defaultState)
}))
