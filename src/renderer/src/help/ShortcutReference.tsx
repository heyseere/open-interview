import { Keyboard } from 'lucide-react'
import { SectionCard } from '@/components/SectionCard'
import { ShortcutRow } from '@/components/ShortcutRow'
import { Well } from '@/components/Well'
import { useI18n } from '@/lib/i18n'
import { SHORTCUT_ACTION_META, SHORTCUT_CATEGORY_LABEL_KEYS } from '@/lib/store/shortcuts'
import type { ShortcutCategory } from '@/lib/store/shortcuts'

/**
 * Read-only shortcut reference for the help page.
 *
 * It renders straight from SHORTCUT_ACTION_META + the live shortcut store, so
 * the page can never drift from what is actually bound. Every row is a span
 * and a keycap — deliberately NOT clickable: the help center is documentation,
 * and rebinding lives in Settings → Shortcuts (which the surrounding prose
 * names in words). An unbound action renders nothing (ShortcutRow's rule).
 */
const CATEGORY_ORDER: ShortcutCategory[] = [
  'screenshotAndAi',
  'windowManagement',
  'navigation',
  'windowMovement'
]

export function ShortcutReference() {
  const { t } = useI18n()

  return (
    <SectionCard icon={Keyboard} title={t('help.shortcutsTitle')}>
      <p className="text-sm text-foreground">{t('help.shortcutsBody')}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const actions = Object.entries(SHORTCUT_ACTION_META)
            .filter(([, meta]) => meta.category === category)
            .map(([action]) => action)
          if (actions.length === 0) return null
          return (
            <Well key={category}>
              <p className="text-micro mb-2 uppercase tracking-wider text-ink-faint">
                {t(SHORTCUT_CATEGORY_LABEL_KEYS[category])}
              </p>
              <div className="space-y-1">
                {actions.map((action) => (
                  <ShortcutRow key={action} action={action} layout="split" />
                ))}
              </div>
            </Well>
          )
        })}
      </div>
      <p className="text-xs text-ink-faint">{t('help.shortcutsEditHint')}</p>
    </SectionCard>
  )
}
