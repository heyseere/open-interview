import * as React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CANVAS, CANVAS_ID } from '@/lib/glass'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { useI18n } from '@/lib/i18n'
import { DwellIconButton } from '@/components/DwellIconButton'

/**
 * Every dialog is the app's own glass canvas, not a separate material — and it
 * is portaled INSIDE that canvas rather than to document.body.
 *
 * Two things go wrong when a dialog portals to the body:
 * 1. It sits outside the layout root that carries `style={{opacity}}`, so it
 *    keeps its own full alpha while every page around it fades — the history
 *    panel read as a solid black board next to the settings page.
 * 2. A layout root with opacity < 1 is a backdrop root, so page content is
 *    flattened into an atomic group the dialog cannot see. Its
 *    `backdrop-filter` then blurs nothing and the answer text shows through
 *    the panel unblurred.
 *
 * Mounting into #app-canvas fixes both at once: the dialog inherits the window
 * fade (so no per-dialog opacity is needed, and none is applied — applying it
 * would make the dialog itself a backdrop root and kill its own blur) and
 * blurs the page behind it like every other glass surface.
 */
function usePortalHost(): HTMLElement | undefined {
  const [host, setHost] = useState<HTMLElement | null>(null)
  // Runs while the dialog is closed (the primitive only renders when open),
  // so the canvas is already committed and no portal re-parenting happens
  // mid-open.
  useEffect(() => {
    setHost(document.getElementById(CANVAS_ID))
  }, [])
  return host ?? undefined
}

/**
 * Close callback of the enclosing Dialog, so the shared close button can be a
 * DwellIconButton. Null for uncontrolled dialogs (no onOpenChange), which fall
 * back to the primitive's own Close.
 */
const DialogCloseContext = createContext<(() => void) | null>(null)

function Dialog({ onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const close = onOpenChange ? () => onOpenChange(false) : null
  return (
    <DialogCloseContext.Provider value={close}>
      <DialogPrimitive.Root data-slot="dialog" onOpenChange={onOpenChange} {...props} />
    </DialogCloseContext.Provider>
  )
}

function DialogPortal({
  container,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const host = usePortalHost()
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal" container={container ?? host} {...props} />
  )
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      // Lighter than the stock /50: the window itself is a see-through sheet,
      // and a heavy scrim turns the whole floating panel into a black block.
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/25',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          CANVAS,
          'text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-modal duration-200 sm:max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && <DialogCloseButton />}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * The shared top-right close button, in the app's icon language: a round
 * dwell button that fires on hover exactly like the header icons and the
 * toolbar (and on click when the hover-trigger setting is off). The stock
 * primitive Close it replaces was a bare 70%-opacity glyph with no hover
 * trigger, which made the history panel's X the only icon in the app that
 * behaved differently from every other one.
 *
 * The progress ring is drawn by DwellIconButton; the button itself stays
 * absolutely positioned in the corner so no dialog has to reserve a row.
 */
function DialogCloseButton() {
  const { t } = useI18n()
  const dwell = useDwellMs()
  const close = useContext(DialogCloseContext)
  if (!close) {
    return (
      <DialogPrimitive.Close
        data-slot="dialog-close"
        className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden"
      >
        <XIcon className="size-4" />
        <span className="sr-only">{t('common.close')}</span>
      </DialogPrimitive.Close>
    )
  }
  return (
    <DwellIconButton
      durationMs={dwell()}
      title={t('common.close')}
      icon={XIcon}
      className="absolute top-3 right-3"
      onTrigger={close}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle
}
