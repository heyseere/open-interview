import { useEffect, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { Dialog, DialogTitle, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { DwellClickable } from '@/components/DwellClickable'
import { useSettingsStore } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'

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
  const toolbarDwellMs = useSettingsStore((state) => state.toolbarDwellMs)
  const [questionInput, setQuestionInput] = useState('')
  const [hasConversation, setHasConversation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Re-evaluate routing and clear stale state whenever the dialog opens
  useEffect(() => {
    if (!open) return
    setQuestionInput('')
    setSubmitError(null)
    setIsSubmitting(false)
    window.api.hasActiveConversation().then(setHasConversation)
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
      <DialogTitle className="sr-only">{t('status.followUp')}</DialogTitle>
      <DialogContent
        showCloseButton={false}
        className="bg-gray-900/90 backdrop-blur-md border border-white/10 text-white sm:max-w-lg"
      >
        <div className="py-4">
          <Textarea
            placeholder={t('status.followUpPlaceholder')}
            value={questionInput}
            className="min-h-24 bg-white/10 border-white/15 text-white placeholder:text-gray-400 focus-visible:ring-blue-400"
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
            <p className="mt-2 text-xs text-red-400" role="alert">
              {submitError}
            </p>
          )}
        </div>
        {/* Footer mirrors the bottom toolbar: round dark-glass dwell buttons */}
        <div className="flex items-center justify-end gap-2">
          <DwellClickable
            durationMs={toolbarDwellMs}
            title={t('common.cancel')}
            disabled={isSubmitting}
            className="size-9 rounded-full flex items-center justify-center text-gray-200 hover:bg-white/10 transition-colors"
            onTrigger={handleClose}
          >
            <X className="size-4" />
          </DwellClickable>
          <DwellClickable
            durationMs={toolbarDwellMs}
            title={t('common.submit')}
            disabled={!questionInput.trim() || isSubmitting}
            className="size-9 rounded-full flex items-center justify-center bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            onTrigger={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" data-testid="follow-up-spinner" />
            ) : (
              <Send className="size-4" />
            )}
          </DwellClickable>
        </div>
      </DialogContent>
    </Dialog>
  )
}
