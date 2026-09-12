import { Keyboard } from 'lucide-react'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'
import { HelpSection } from './components'

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  'Window Management': 'help.catWindowManagement',
  'Screenshot & AI': 'help.catScreenshotAi',
  Navigation: 'help.catNavigation',
  'Window Movement': 'help.catWindowMovement'
}

const DESCRIPTION_KEYS: Record<string, TranslationKey> = {
  hideOrShowMainWindow: 'help.descHideOrShow',
  ignoreOrEnableMouse: 'help.descMousePassThrough',
  toggleMiniMode: 'help.descToggleMiniMode',
  takeScreenshot: 'help.descTakeScreenshot',
  appendScreenshot: 'help.descAppendScreenshot',
  stopSolutionStream: 'help.descStop',
  followUpQuestion: 'help.descFollowUp',
  toggleTranscription: 'help.descToggleTranscription',
  clearTranscription: 'help.descClearTranscription',
  pageUp: 'help.descPageUp',
  pageDown: 'help.descPageDown',
  moveMainWindowUp: 'help.descMoveUp',
  moveMainWindowDown: 'help.descMoveDown',
  moveMainWindowLeft: 'help.descMoveLeft',
  moveMainWindowRight: 'help.descMoveRight'
}

export function Shortcuts() {
  const { t } = useI18n()
  return (
    <HelpSection
      Icon={Keyboard}
      title={t('help.shortcutsTitle')}
      description={t('help.shortcutsDesc')}
    >
      <ShortcutItemGroup category="Window Management" />
      <ShortcutItemGroup category="Screenshot & AI" />
      <ShortcutItemGroup category="Navigation" />
      <ShortcutItemGroup category="Window Movement" />
    </HelpSection>
  )
}

function ShortcutItemGroup({ category }: { category: string }) {
  const { t } = useI18n()
  const { shortcuts } = useShortcutsStore()
  return (
    <div className="space-y-2">
      <h3 className="text-sm text-gray-500">
        {t(CATEGORY_KEYS[category] ?? 'help.shortcutsTitle')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.values(shortcuts)
          .filter((shortcut) => shortcut.category === category)
          .map((shortcut, index) => (
            <ShortcutItem key={index} action={shortcut.action} shortcutKey={shortcut.key} />
          ))}
      </div>
    </div>
  )
}

function ShortcutItem({ action, shortcutKey }: { action: string; shortcutKey: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between rounded border border-gray-400 px-2 py-1">
      <span className="text-sm">
        {DESCRIPTION_KEYS[action] ? t(DESCRIPTION_KEYS[action]) : action}
      </span>
      <ShortcutRenderer shortcut={shortcutKey} variant="light" className="select-none" />
    </div>
  )
}
