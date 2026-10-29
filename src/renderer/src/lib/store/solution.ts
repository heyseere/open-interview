import { create } from 'zustand'
import { ChunkBuffer } from '@/lib/utils/chunk-buffer'
import type { SolutionErrorAction } from '@shared/solution-error'

/** Coalesce streaming chunks so renders batch at ~10 fps instead of per-chunk. */
const CHUNK_FLUSH_MS = 100

interface SolutionState {
  isLoading: boolean
  solutionChunks: string[]
  screenshotData: string | null
  /** Gallery of the session's screenshots (mirrors main's conversation). */
  recentScreenshots: string[]
  errorMessage: string | null
  /**
   * Which repair affordance the error row renders for `errorMessage`
   * (retry / open permissions / open settings). Null = message only.
   */
  errorAction: SolutionErrorAction | null
  /**
   * Bumped whenever the conversation is cleared. Consumers that query
   * main-side conversation state (which loading transitions do not cover,
   * e.g. "new conversation" while idle) re-run on this value.
   */
  resetEpoch: number
}

interface SolutionStore extends SolutionState {
  setIsLoading: (isReceiving: boolean) => void
  addSolutionChunk: (chunk: string) => void
  setSolutionChunks: (chunks: string[]) => void
  setScreenshotData: (data: string | null) => void
  setRecentScreenshots: (screenshots: string[]) => void
  setErrorMessage: (message: string | null, action?: SolutionErrorAction) => void
  clearSolution: () => void
}

const defaultState: SolutionState = {
  isLoading: false,
  solutionChunks: [],
  screenshotData: null,
  recentScreenshots: [],
  errorMessage: null,
  errorAction: null,
  resetEpoch: 0
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
  setRecentScreenshots: (recentScreenshots) => {
    set({ recentScreenshots })
  },
  setErrorMessage: (message, action) => {
    set({ errorMessage: message, errorAction: message ? (action ?? null) : null })
  },
  clearSolution: () => {
    getBuffer(set).flush()
    set((state) => ({
      solutionChunks: [],
      isLoading: false,
      errorMessage: null,
      errorAction: null,
      resetEpoch: state.resetEpoch + 1
    }))
  }
}))
