import { create } from 'zustand'
import { ChunkBuffer } from '@/lib/utils/chunk-buffer'

/** Coalesce streaming chunks so renders batch at ~10 fps instead of per-chunk. */
const CHUNK_FLUSH_MS = 100

interface SolutionState {
  isLoading: boolean
  solutionChunks: string[]
  screenshotData: string | null
  errorMessage: string | null
}

interface SolutionStore extends SolutionState {
  setIsLoading: (isReceiving: boolean) => void
  addSolutionChunk: (chunk: string) => void
  setSolutionChunks: (chunks: string[]) => void
  setScreenshotData: (data: string | null) => void
  setErrorMessage: (message: string | null) => void
  clearSolution: () => void
  resetState: () => void
}

const defaultState: SolutionState = {
  isLoading: false,
  solutionChunks: [],
  screenshotData: null,
  errorMessage: null
}

type SolutionSet = (
  partial: Partial<SolutionState> | ((state: SolutionState) => Partial<SolutionState>)
) => void

let pendingBuffer: ChunkBuffer | null = null

/** Main emits the turn separator as an isolated chunk event before each turn. */
const TURN_SEPARATOR = '\n\n---\n\n'

function getBuffer(set: SolutionSet): ChunkBuffer {
  if (!pendingBuffer) {
    pendingBuffer = new ChunkBuffer({
      delayMs: CHUNK_FLUSH_MS,
      onFlush: (batch) => {
        set((state) => {
          // Regenerate flow clears the store right before replaying, so the
          // turn separator would render as a stray rule at the top — drop it
          // when it is the first content after an empty buffer.
          const effective =
            state.solutionChunks.length === 0
              ? batch.filter((chunk) => chunk !== TURN_SEPARATOR)
              : batch
          if (effective.length === 0) return {}
          return { solutionChunks: [...state.solutionChunks, ...effective] }
        })
      }
    })
  }
  return pendingBuffer
}

export const useSolutionStore = create<SolutionStore>()((set) => ({
  ...defaultState,
  setIsLoading: (isLoading) => {
    // Loading ended (complete/stop/error): deliver any buffered tail first so
    // the final text lands before the UI leaves the loading state.
    if (!isLoading) getBuffer(set).flush()
    set({ isLoading })
  },
  addSolutionChunk: (chunk) => {
    getBuffer(set).push(chunk)
  },
  setSolutionChunks: (chunks) => {
    getBuffer(set).flush()
    set({ solutionChunks: chunks })
  },
  setScreenshotData: (data) => {
    set({ screenshotData: data })
  },
  setErrorMessage: (message) => {
    set({ errorMessage: message })
  },
  clearSolution: () => {
    getBuffer(set).flush()
    set({ solutionChunks: [], isLoading: false, errorMessage: null })
  },
  resetState: () => {
    getBuffer(set).flush()
    set(defaultState)
  }
}))
