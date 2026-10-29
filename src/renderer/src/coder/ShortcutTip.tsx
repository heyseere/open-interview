import { GLASS_BORDER, GLASS_CARD } from '@/lib/glass'
import { useI18n } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/settings'
import { ShortcutRow } from '@/components/ShortcutRow'
import { useWindowSize } from '@/lib/utils/use-window-size'

/**
 * Initial-state shortcut listing. Rendered INSIDE the window's opacity fade
 * (see CoderPage) as a dark glass card — the same surface language as the
 * status bar and hover toolbar, so it stays readable over arbitrary on-screen
 * content without any text-outline hacks.
 *
 * It used to fade itself one step deeper than the window (opacity + 0.1) so it
 * read as its own layer while the canvas stayed fully opaque. Now that the
 * canvas itself fades, an extra local opacity would double-fade the card, so
 * it simply inherits the window setting.
 *
 * The listing degrades with the window size: small windows drop the window
 * group and the rarely used move-page actions first, and the smallest tier
 * keeps only the three core capture/voice rows. The bottom padding reserves
 * the hover toolbar's band (36px offset + 44px pill), and below ~380px of
 * height the card is dropped entirely — the toolbar carries the same
 * actions — so the two never overlap.
 */
const AI_ACTIONS = [
  'takeScreenshot',
  'appendScreenshot',
  'captureFullPage',
  'stopSolutionStream',
  'followUpQuestion',
  'toggleTranscription',
  'clearTranscription',
  'switchScene'
]
const WINDOW_ACTIONS = [
  'hideOrShowMainWindow',
  'ignoreOrEnableMouse',
  'toggleMiniMode',
  'opacityUp',
  'opacityDown',
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
  'opacityUp',
  'opacityDown',
  'pageUp',
  'pageDown'
]
/** Smallest tier: only the core capture/voice rows, single column. */
const AI_ACTIONS_CORE = ['takeScreenshot', 'appendScreenshot', 'toggleTranscription']

/**
 * Density tiers by window size (width × height). Height thresholds include
 * the hover toolbar's bottom band (~124px total: 40px top padding + 84px
 * bottom reserve), so each tier's centered card clears the toolbar — the
 * full card is ~460px tall, the reduced one ~330px.
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

  const renderGroup = (title: Parameters<typeof t>[0], actions: string[]) => (
    <div className="min-w-[220px]">
      <p className="text-micro uppercase tracking-wider text-ink-faint mb-2">{t(title)}</p>
      <div className="space-y-1">
        {actions.map((action) => (
          <ShortcutRow key={action} action={action} layout="split" />
        ))}
      </div>
    </div>
  )

  return (
    // Full-viewport, pointer-transparent so the faded header/content beneath
    // stay interactive. Opacity is inherited from the window root — no local
    // fade here, or the card would end up twice as transparent as the sheet.
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center pt-10 select-none ${
        toolbarVisible ? 'pb-[84px]' : 'pb-6'
      }`}
    >
      <div className={`${GLASS_CARD} rounded-xl ${GLASS_BORDER} px-8 py-6`}>
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
