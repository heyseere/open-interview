import { cn } from '@/lib/utils'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useI18n } from '@/lib/i18n'
import { SHORTCUT_ACTION_META, useShortcutsStore } from '@/lib/store/shortcuts'

/**
 * "Label + keycap" for a bound action, resolved from the LIVE shortcut store
 * (a rebound action must never read a stale literal). Two layouts:
 * - split: label left, keycap right — the shortcut tip card
 * - inline: keycap then label — the status hint strip
 * Renders nothing while the action is unbound.
 */
export function ShortcutRow({
  action,
  layout,
  size = 'md',
  className
}: {
  action: string
  layout: 'split' | 'inline'
  size?: 'sm' | 'md'
  className?: string
}) {
  const { t } = useI18n()
  const key = useShortcutsStore((state) => state.shortcuts[action]?.key)
  const meta = SHORTCUT_ACTION_META[action]
  if (!key || !meta) return null
  if (layout === 'split') {
    return (
      <div className={cn('flex items-center justify-between gap-6 py-0.5', className)}>
        <span className="text-sm text-ink">{t(meta.labelKey)}</span>
        <ShortcutRenderer shortcut={key} size={size} />
      </div>
    )
  }
  return (
    <span className={cn('flex items-center gap-1 whitespace-nowrap', className)}>
      <ShortcutRenderer shortcut={key} size={size} />
      {t(meta.labelKey)}
    </span>
  )
}
