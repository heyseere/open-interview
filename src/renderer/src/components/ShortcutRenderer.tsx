import { cn } from '@renderer/lib/utils'
import { getShortcutAcceleratorDisplay } from '@/lib/utils/keyboard'

/**
 * The single keycap component for rendering accelerator strings: a dark
 * translucent keycap that stays readable on glass surfaces and over
 * arbitrary screen content.
 */
export default function ShortcutRenderer({
  shortcut,
  className,
  size = 'md'
}: {
  shortcut: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const keys = getShortcutAcceleratorDisplay(shortcut).split('+')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-hairline bg-hairline font-semibold text-white whitespace-nowrap transition-colors',
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
