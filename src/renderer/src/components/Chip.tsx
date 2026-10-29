import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Pill family — one shape (rounded-full bordered), two interactive intents:
 * - select: glass chip that fills solid blue when `active` (scene/model
 *   pickers)
 * - add: dashed "create new" affordance
 * Non-interactive semantic statuses use StatusChip below.
 */
const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-full border transition-colors cursor-pointer select-none'
const CHIP_SIZES = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' } as const

export function Chip({
  size = 'sm',
  intent = 'select',
  active = false,
  type,
  className,
  ...props
}: {
  size?: keyof typeof CHIP_SIZES
  intent?: 'select' | 'add'
  active?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        CHIP_BASE,
        CHIP_SIZES[size],
        intent === 'add'
          ? 'border-dashed border-hairline-2 bg-transparent text-ink-faint hover:border-live hover:text-live-soft'
          : active
            ? 'border-action bg-action text-white hover:border-action hover:text-white'
            : 'border-hairline bg-veil text-ink hover:border-live hover:text-live-soft',
        className
      )}
      {...props}
    />
  )
}

/** Translucent semantic pill for non-interactive statuses (ok/warn/bad/neutral). */
const STATUS_TONES = {
  ok: 'border-good/40 bg-good/15 text-good-soft',
  warn: 'border-warn/40 bg-warn/15 text-warn-soft',
  bad: 'border-bad/40 bg-bad/15 text-bad-soft',
  neutral: 'border-hairline bg-veil text-ink-faint'
} as const

export function StatusChip({
  tone = 'neutral',
  className,
  children,
  ...props
}: {
  tone?: keyof typeof STATUS_TONES
  className?: string
  children: ReactNode
  title?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
