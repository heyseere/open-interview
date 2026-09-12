import { cn } from '@renderer/lib/utils'
import { getShortcutAcceleratorDisplay } from '@/lib/utils/keyboard'

/**
 * The single keycap component for rendering accelerator strings.
 *
 * - `glass` (default): dark translucent keycap that stays readable on the
 *   main UI's dark glass surfaces AND over arbitrary screen content — use it
 *   everywhere in the coder page (status bar, shortcut tip, toolbars).
 * - `light`: opaque light keycap for light backgrounds (settings cards,
 *   help page).
 */
export default function ShortcutRenderer({
  shortcut,
  className,
  variant = 'glass',
  size = 'md'
}: {
  shortcut: string
  className?: string
  variant?: 'glass' | 'light'
  size?: 'sm' | 'md'
}) {
  const keys = getShortcutAcceleratorDisplay(shortcut).split('+')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-semibold whitespace-nowrap transition-colors',
        variant === 'glass'
          ? 'border-white/25 bg-white/10 text-white'
          : 'border-black/10 bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm',
        size === 'sm' ? 'py-0 px-1.5 text-xs' : 'py-1 px-2 text-sm',
        className
      )}
    >
      {keys.map((key) => (
        <span key={key}>{key}</span>
      ))}
    </span>
  )
}
