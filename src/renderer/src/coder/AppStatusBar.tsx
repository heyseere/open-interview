import { useEffect, useState } from 'react'
import { useSolutionStore } from '@/lib/store/solution'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'
import { useWindowSize } from '@/lib/utils/use-window-size'

/** Shortcut action → status-hint label. */
const HINT_LABEL_KEYS: Record<string, TranslationKey> = {
  appendScreenshot: 'status.appendScreenshot',
  followUpQuestion: 'status.followUp',
  takeScreenshot: 'status.newConversation'
}

/** Status-hint visibility ladders with the window width: the row shortens
 * first (fewest-used actions drop), then disappears — the hover toolbar
 * offers the same actions, so narrow windows lose nothing but clutter. */
const HINT_LADDER: Array<{ minWidth: number; actions: string[] }> = [
  { minWidth: 760, actions: ['appendScreenshot', 'followUpQuestion', 'takeScreenshot'] },
  { minWidth: 600, actions: ['appendScreenshot', 'followUpQuestion'] },
  { minWidth: 460, actions: ['appendScreenshot'] },
  { minWidth: 0, actions: [] }
]

export function AppStatusBar() {
  const { t } = useI18n()
  const { isLoading: isReceivingSolution, screenshotData, solutionChunks } = useSolutionStore()
  const { shortcuts } = useShortcutsStore()
  const { width } = useWindowSize()
  const [hasActiveConversation, setHasActiveConversation] = useState(false)

  // The main process owns the conversation history, so query it directly
  // (rather than deriving from screenshots) to also cover text-only
  // conversations sent via transcription. Generation progress moved into the
  // hover toolbar's persistent turn-state button; the follow-up entry lives
  // here as a shortcut hint (it opens via Alt+F or the toolbar's 追问 button).
  useEffect(() => {
    if (isReceivingSolution) return
    window.api.hasActiveConversation().then(setHasActiveConversation)
  }, [screenshotData, solutionChunks.length, isReceivingSolution])

  const actions = HINT_LADDER.find((tier) => width >= tier.minWidth)!.actions

  return (
    <div className="absolute bottom-0 flex items-center justify-between w-full text-blue-100 bg-gray-600/10 px-4 pb-1">
      {hasActiveConversation && !isReceivingSolution && actions.length > 0 ? (
        <div className="flex items-center space-x-2 pointer-events-none opacity-50 text-sm gap-1 min-w-0 overflow-hidden">
          {actions.map((action) => (
            <span key={action} className="flex items-center gap-1 whitespace-nowrap">
              <ShortcutRenderer shortcut={shortcuts[action].key} size="sm" />
              {t(HINT_LABEL_KEYS[action])}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
