import ShortcutRenderer from '@/components/ShortcutRenderer'
import { useShortcutsStore } from '@/lib/store/shortcuts'

/**
 * Keycap for a bound action, resolved from the LIVE shortcut store.
 *
 * Help prose must never hard-code an accelerator: the user can rebind every
 * action in Settings, and a stale literal (`Alt+Enter`) would then describe a
 * key that does nothing.
 */
export function ActionShortcut({
  action,
  size = 'md',
  className
}: {
  action: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const key = useShortcutsStore((state) => state.shortcuts[action]?.key)
  if (!key) return null
  return <ShortcutRenderer shortcut={key} size={size} className={className} />
}
