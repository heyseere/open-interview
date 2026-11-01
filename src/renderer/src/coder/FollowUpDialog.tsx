import { useEffect, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { DwellIconButton } from '@/components/DwellIconButton'
import { useI18n } from '@/lib/i18n'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { useHasActiveConversation } from './use-has-active-conversation'
import { SHORTCUT_ACTION_META } from '@/lib/store/shortcuts'

interface FollowUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Ask-a-follow-up dialog shared by the status bar and the hover toolbar.
 *
 * - The footer uses the same dark round-icon button style as the bottom hover
 *   toolbar; the submit button shows a spinner while the request is starting
 *   and any failure is reported inline instead of closing silently.
 * - When no conversation exists yet this acts as a first "text input": it is
 *   sent as a standalone text message rather than a follow-up.
 */
export function FollowUpDialog({ open, onOpenChange }: FollowUpDialogProps) {
  const { t } = useI18n()
  // The shared dwell rule (useDwellMs), NOT the raw toolbarDwellMs: with the
  // hover-trigger setting off the dialog buttons must be click-only too.
  const dwell = useDwellMs()
  const [questionInput, setQuestionInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Routing (follow-up vs. first text message) is exactly the shared query;
  // the hook re-runs on turn boundaries, so opening the dialog needs no extra
  // round-trip of its own.
  const hasConversation = useHasActiveConversation()
  // While the dialog is open the lift is held: the dialog renders in a portal
  // outside the toolbar's rect, and without this passthrough would come back
  // the moment the pointer leaves the toolbar, making the dialog untouchable.
  const lift = usePassthroughLift({ hold: open })

  // Clear stale input whenever the dialog opens
  useEffect(() => {
    if (!open) return
    setQuestionInput('')
    setSubmitError(null)
    setIsSubmitting(false)
  }, [open])

  const handleClose = () => onOpenChange(false)

  const handleSubmit = async () => {
    const question = questionInput.trim()
    if (!question || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result =
        hasConversation && open
          ? await window.api.sendFollowUpQuestion(question)
          : await window.api.sendTextMessage(question)
      if (!result.success) {
        setSubmitError(result.error || t('status.followUpFailed'))
      }
    } catch (error) {
      console.error('Error sending follow-up question:', error)
      setSubmitError(t('status.followUpFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={lift.ref} showCloseButton={false} className="text-white sm:max-w-lg">
        {/* Inside DialogContent so the accessible name lives in the dialog
            subtree (Radix portals this markup). */}
        <DialogTitle className="sr-only">
          {t(SHORTCUT_ACTION_META.followUpQuestion.labelKey)}
        </DialogTitle>
        <div className="py-4">
          <Textarea
            placeholder={t('status.followUpPlaceholder')}
            value={questionInput}
            className="min-h-24 bg-hairline"
            onChange={(e) => {
              setQuestionInput(e.target.value)
              setSubmitError(null)
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {submitError && (
            <p className="mt-2 text-xs text-bad-soft" role="alert">
              {submitError}
            </p>
          )}
        </div>
        {/* Footer mirrors the bottom toolbar: round dark-glass dwell buttons */}
        <div className="flex items-center justify-end gap-2">
          <DwellIconButton
            durationMs={dwell()}
            title={t('common.cancel')}
            disabled={isSubmitting}
            icon={X}
            size="lg"
            onTrigger={handleClose}
          />
          <DwellIconButton
            durationMs={dwell()}
            title={t('common.submit')}
            disabled={!questionInput.trim() || isSubmitting}
            primary
            icon={isSubmitting ? Loader2 : Send}
            iconClassName={isSubmitting ? 'animate-spin' : undefined}
            size="lg"
            onTrigger={() => void handleSubmit()}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
