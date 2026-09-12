import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'
import { useSettingsStore } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useWindowSize } from '@/lib/utils/use-window-size'

/**
 * Initial-state shortcut listing. Rendered OUTSIDE the window's opacity fade
 * (see CoderPage) as a dark glass card — the same surface language as the
 * transcription bar and hover toolbar, so it stays readable over arbitrary
 * on-screen content without any text-outline hacks.
 *
 * The listing degrades with the window size: small windows drop the window
 * group and the rarely used move-page actions first, and the smallest tier
 * keeps only the three core capture/voice rows. The bottom padding reserves
 * the hover toolbar's band (36px offset + 44px pill), and below ~380px of
 * height the card is dropped entirely — the toolbar carries the same
 * actions — so the two never overlap.
 */
const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  takeScreenshot: 'shortcuts.takeScreenshot',
  appendScreenshot: 'shortcuts.appendScreenshot',
  stopSolutionStream: 'shortcuts.stopGenerating',
  followUpQuestion: 'shortcuts.followUpQuestion',
  toggleTranscription: 'shortcuts.toggleTranscription',
  clearTranscription: 'shortcuts.clearTranscription',
  hideOrShowMainWindow: 'shortcuts.hideOrShow',
  ignoreOrEnableMouse: 'shortcuts.mousePassThrough',
  toggleMiniMode: 'shortcuts.toggleMiniMode',
  pageUp: 'shortcuts.pageUp',
  pageDown: 'shortcuts.pageDown',
  moveMainWindowUp: 'shortcuts.moveUp',
  moveMainWindowDown: 'shortcuts.moveDown',
  moveMainWindowLeft: 'shortcuts.moveLeft',
  moveMainWindowRight: 'shortcuts.moveRight'
}

const AI_ACTIONS = [
  'takeScreenshot',
  'appendScreenshot',
  'stopSolutionStream',
  'followUpQuestion',
  'toggleTranscription',
  'clearTranscription'
]
const WINDOW_ACTIONS = [
  'hideOrShowMainWindow',
  'ignoreOrEnableMouse',
  'toggleMiniMode',
  'pageUp',
  'pageDown',
  'moveMainWindowUp',
  'moveMainWindowDown',
  'moveMainWindowLeft',
  'moveMainWindowRight'
]
/** Reduced window group for medium windows: movement shortcuts go first. */
const WINDOW_ACTIONS_REDUCED = [
  'hideOrShowMainWindow',
  'ignoreOrEnableMouse',
  'toggleMiniMode',
  'pageUp',
  'pageDown'
]
/** Smallest tier: only the core capture/voice rows, single column. */
const AI_ACTIONS_CORE = ['takeScreenshot', 'appendScreenshot', 'toggleTranscription']

/**
 * Density tiers by window size (width × height). Height thresholds include
 * the hover toolbar's bottom band (~124px total: 40px top padding + 84px
 * bottom reserve), so each tier's centered card clears the toolbar — the
 * full card is ~450px tall, the reduced one ~335px.
 */
function resolveTier(width: number, height: number): 'full' | 'reduced' | 'minimal' {
  if (width >= 860 && height >= 600) return 'full'
  if (width >= 700 && height >= 480) return 'reduced'
  return 'minimal'
}

/** Below this height even the minimal card cannot clear the toolbar band. */
const MIN_TIP_HEIGHT = 380

export function ShortcutTip() {
  const { t } = useI18n()
  const { shortcuts } = useShortcutsStore()
  const opacity = useSettingsStore((state) => state.opacity)
  const toolbarEnabled = useSettingsStore((state) => state.toolbarEnabled)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const { width, height } = useWindowSize()

  // The hover toolbar renders on the standard layout only (HoverToolbar's own
  // gate); reserve its band so the centered card never slides under it
  const toolbarVisible = toolbarEnabled && uiLayout !== 'compact'
  if (height < MIN_TIP_HEIGHT) return null

  const tier = resolveTier(width, height)
  const aiActions = tier === 'minimal' ? AI_ACTIONS_CORE : AI_ACTIONS
  const windowActions =
    tier === 'full' ? WINDOW_ACTIONS : tier === 'reduced' ? WINDOW_ACTIONS_REDUCED : []

  const renderRow = (action: string) => {
    const shortcut = shortcuts[action]
    const labelKey = ACTION_LABEL_KEYS[action]
    if (!shortcut || !labelKey) return null
    return (
      <div key={action} className="flex items-center justify-between gap-6 py-0.5">
        <span className="text-sm text-gray-200">{t(labelKey)}</span>
        <ShortcutRenderer shortcut={shortcut.key} variant="glass" />
      </div>
    )
  }

  const renderGroup = (title: TranslationKey, actions: string[]) => (
    <div className="min-w-[220px]">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{t(title)}</p>
      <div className="space-y-1">{actions.map(renderRow)}</div>
    </div>
  )

  return (
    // Full-viewport, pointer-transparent so the faded header/content beneath
    // stay interactive. The mask follows the window opacity setting but stays
    // one just-noticeable step deeper (+0.1), so the shortcut card always
    // reads as its own layer without breaking the overall transparency.
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center pt-10 select-none ${
        toolbarVisible ? 'pb-[84px]' : 'pb-6'
      }`}
      style={{ opacity: Math.min(1, opacity + 0.1) }}
    >
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-white/10 shadow-xl px-8 py-6">
        <p className="text-sm font-medium text-white mb-5 text-center">
          {t('coder.pressShortcut')}
        </p>
        <div className={`flex ${windowActions.length > 0 ? 'gap-12' : 'justify-center'}`}>
          {renderGroup('coder.shortcutGroupAi', aiActions)}
          {windowActions.length > 0 && renderGroup('coder.shortcutGroupWindow', windowActions)}
        </div>
      </div>
    </div>
  )
}
