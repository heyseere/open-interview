import { useEffect, useState } from 'react'
import { useSolutionStore } from '@/lib/store/solution'

/**
 * Whether the main process holds an active conversation (screenshot OR
 * text-only, hence the IPC query instead of deriving from screenshots).
 *
 * Re-queried only on turn boundaries: while a stream is running the value is
 * frozen, and when loading ends the answer has just committed. This replaces
 * three per-component copies that keyed the query on every solution chunk —
 * i.e. two IPC round-trips per 100 ms flush during streaming.
 */
export function useHasActiveConversation(): boolean {
  const isLoading = useSolutionStore((state) => state.isLoading)
  const resetEpoch = useSolutionStore((state) => state.resetEpoch)
  const [hasConversation, setHasConversation] = useState(false)

  useEffect(() => {
    if (isLoading) return
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
