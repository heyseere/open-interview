import type { Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { iconStateClass, ICON_ACTIVE_BG, ICON_PRIMARY } from '@/lib/icon-state'
import { DwellClickable, type DwellSource } from '@/components/DwellClickable'

/**
 * Round glass icon button on the hover-dwell contract — the ONE recipe every
 * icon surface shares (header bar, hover toolbar, scroll rail, dialog close
 * button, compact back button). Composes DwellClickable (progress fill, dwell
 * cooldown, automatic no-drag opt-out) with the shared color states from
 * lib/icon-state, so a new icon surface never re-assembles the class string
 * by hand.
 */
const SIZES = { sm: 'size-6', md: 'size-8', lg: 'size-9' } as const
const ICON_SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-4' } as const

export function DwellIconButton({
  icon: Icon,
  size = 'md',
  primary = false,
  active = false,
  danger = false,
  dim = false,
  wash = false,
  disabled = false,
  pressed,
  title,
  durationMs,
  onTrigger,
  onHoverEnd,
  iconClassName,
  className,
  ref
}: {
  icon: LucideIcon
  size?: keyof typeof SIZES
  /** Solid action color (dialog submit) instead of glass states. */
  primary?: boolean
  active?: boolean
  danger?: boolean
  dim?: boolean
  /** ACTIVE wash behind the icon without flipping its color (toolbar toggles). */
  wash?: boolean
  disabled?: boolean
  /** Toggle state, forwarded as aria-pressed (undefined = not a toggle). */
  pressed?: boolean
  title: string
  /** Dwell duration from useDwellMs(); <= 0 makes the button click-only. */
  durationMs: number
  onTrigger: (source: DwellSource) => void
  onHoverEnd?: () => void
  /** Extra classes on the icon itself (e.g. `animate-spin` on a loader). */
  iconClassName?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <DwellClickable
      ref={ref}
      durationMs={durationMs}
      title={title}
      // Icon-only buttons are the tooltip problem surface: hovering to read
      // the label would fire the dwell first, so the native title must go.
      tooltip
      pressed={pressed}
      disabled={disabled}
      onTrigger={onTrigger}
      onHoverEnd={onHoverEnd}
      className={cn(
        'flex items-center justify-center rounded-full',
        SIZES[size],
        primary ? ICON_PRIMARY : iconStateClass({ active, disabled, danger, dim }),
        wash && !primary ? ICON_ACTIVE_BG : '',
        className
      )}
    >
      <Icon className={cn(ICON_SIZES[size], iconClassName)} />
    </DwellClickable>
  )
}
