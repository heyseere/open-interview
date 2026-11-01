import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

/**
 * Shared settings-page primitives.
 *
 * The settings page is a long list of "label + hint on the left, control on
 * the right" rows inside identical glass cards. Every such row used to be
 * copied by hand (23 rows / 8 cards), which is why a single styling change
 * touched dozens of places.
 */

/**
 * One label(+hint) / control row. The hint is optional. `stacked` puts the
 * control on its own line under the label (long blocks: local model, scenes,
 * prompt editor); the default is side-by-side.
 */
export function SettingsRow({
  label,
  hint,
  stacked = false,
  children
}: {
  label: ReactNode
  hint?: ReactNode
  stacked?: boolean
  children: ReactNode
}) {
  const labelNode = (
    <label className="text-sm font-medium">
      {label}
      {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
  if (stacked) {
    return (
      <div>
        {labelNode}
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between">
      {labelNode}
      {children}
    </div>
  )
}

/** Minus / value / plus stepper used by chunk length and tool dwell. */
export function SettingsStepper({
  value,
  display,
  min,
  max,
  step,
  normalize,
  onChange,
  decreaseTitle,
  increaseTitle
}: {
  value: number
  display: ReactNode
  min: number
  max: number
  step: number
  normalize: (value: number) => number
  onChange: (value: number) => void
  decreaseTitle: string
  increaseTitle: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        disabled={value <= min}
        onClick={() => onChange(normalize(value - step))}
        title={decreaseTitle}
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-16 text-center text-sm font-medium">{display}</span>
      <Button
        variant="outline"
        size="icon"
        disabled={value >= max}
        onClick={() => onChange(normalize(value + step))}
        title={increaseTitle}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

/** Outline action button that swaps its icon for a spinner while busy. */
export function BusyButton({
  busy,
  icon: Icon,
  children,
  className,
  ...props
}: {
  busy: boolean
  icon: LucideIcon
  children: ReactNode
  className?: string
} & Omit<React.ComponentProps<typeof Button>, 'children' | 'className'>) {
  return (
    <Button variant="outline" className={cn('whitespace-nowrap px-3', className)} {...props}>
      {busy ? (
        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
      ) : (
        <Icon className="size-3.5 mr-1.5" />
      )}
      {children}
    </Button>
  )
}

/**
 * Single-input dialog used by the three scene actions (add / rename / delete
 * keeps its own body but shares the shell). Enter submits, Escape cancels.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onValueChange,
  placeholder,
  maxLength = 20,
  confirmLabel,
  onConfirm,
  destructive
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
