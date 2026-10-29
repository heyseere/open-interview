import { useSolutionStore } from '@/lib/store/solution'
import { useWindowSize } from '@/lib/utils/use-window-size'
import { ShortcutRow } from '@/components/ShortcutRow'
import { useHasActiveConversation } from './use-has-active-conversation'

/** Status-hint visibility ladders with the window width: the row shortens
 * first (fewest-used actions drop), then disappears — the hover toolbar
 * offers the same actions, so narrow windows lose nothing but clutter. */
const HINT_LADDER: Array<{ minWidth: number; actions: string[] }> = [
  { minWidth: 760, actions: ['appendScreenshot', 'followUpQuestion', 'takeScreenshot'] },
  { minWidth: 600, actions: ['appendScreenshot', 'followUpQuestion'] },
  { minWidth: 460, actions: ['appendScreenshot'] },
  { minWidth: 0, actions: [] }
]

export function ShortcutHints() {
  const isReceivingSolution = useSolutionStore((state) => state.isLoading)
  const { width } = useWindowSize()
  // The main process owns the conversation history, so query it directly
  // (rather than deriving from screenshots) to also cover text-only
  // conversations sent via transcription. Generation progress moved into the
  // hover toolbar's persistent turn-state button; the follow-up entry lives
  // here as a shortcut hint (it opens via Alt+F or the toolbar's 追问 button).
  const hasActiveConversation = useHasActiveConversation()

  const actions = HINT_LADDER.find((tier) => width >= tier.minWidth)!.actions
  const visible = hasActiveConversation && !isReceivingSolution && actions.length > 0
  if (!visible) return null

  return (
    <div className="absolute bottom-0 flex items-center justify-between w-full text-live-soft bg-band-wash px-4 pb-1">
      <div className="flex items-center space-x-2 pointer-events-none opacity-50 text-sm gap-1 min-w-0 overflow-hidden">
        {actions.map((action) => (
          <ShortcutRow key={action} action={action} layout="inline" size="sm" />
        ))}
      </div>
    </div>
  )
}
