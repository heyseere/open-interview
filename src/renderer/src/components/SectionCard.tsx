import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { PANEL } from '@/lib/glass'

/**
 * One raised section panel (settings / help / permissions): white wash over
 * the glass canvas + shadow, deliberately borderless — hierarchy comes from
 * the background step, not from lines.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`${PANEL} rounded-xl p-6`}>
      <h2 className="text-lg font-semibold mb-4 flex items-center text-foreground">
        <Icon className="size-5 mr-2" />
        {title}
        {description ? (
          <span className="ml-2 pt-1 text-xs text-muted-foreground">{description}</span>
        ) : null}
        {actions ? <div className="ml-auto">{actions}</div> : null}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
