import { useEffect, useState } from 'react'
import { useSolutionStore } from '@/lib/store/solution'

/**
 * Whether the main process holds an active conversation (screenshot OR
 * text-only, hence the IPC query instead of deriving from screenshots).
 *
 * Re-queried on loading transitions and turn boundaries — twice per turn, not
 * per chunk. Skipping the loading-start query would freeze the value at its
 * pre-stream reading: opening the follow-up dialog during the FIRST answer
 * (no conversation before the stream) would then submit as a standalone text
 * message instead of a follow-up carrying the screenshot context. This
 * replaces three per-component copies that keyed the query on every solution
 * chunk — i.e. two IPC round-trips per 100 ms flush during streaming.
 */
export function useHasActiveConversation(): boolean {
  const isLoading = useSolutionStore((state) => state.isLoading)
  const resetEpoch = useSolutionStore((state) => state.resetEpoch)
  const [hasConversation, setHasConversation] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api.hasActiveConversation().then((value) => {
      if (!cancelled) setHasConversation(value)
    })
    return () => {
      cancelled = true
    }
  }, [isLoading, resetEpoch])

  return hasConversation
}
