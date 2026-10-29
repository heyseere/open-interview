import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { GLASS_WELL } from '@/lib/glass'

/**
 * Inset well for secondary content inside a SectionCard — notes, steps, FAQ
 * entries, support boxes. One recipe app-wide: black/20 inset + hairline
 * border (GLASS_WELL), rounded-lg, p-4; extra layout classes via className.
 */
export function Well({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg p-4', GLASS_WELL, className)} {...props} />
}
