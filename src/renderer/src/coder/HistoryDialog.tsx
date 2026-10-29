import { useCallback, useEffect, useRef, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import MathText from '@/components/MathText'
import { GLASS_WELL } from '@/lib/glass'
import { useI18n } from '@/lib/i18n'
import { usePassthroughLift } from '@/lib/passthrough-lift'

interface ConversationTurn {
  question: string
  answer: string
}

interface ConversationRecord {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  turns: ConversationTurn[]
}

interface ConversationSummary {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  turnCount: number
}

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Conversation history panel.
 *
 * A dialog rather than a route on purpose: navigating away unmounts CoderPage,
 * whose cleanup stops an in-flight transcription and clears `inCoderPage` (which
 * disables Alt+M). History is opened mid-answer, so it has to overlay the coder
 * page, not replace it.
 *
 * Layout is master/detail: conversation list on the left, the selected
 * conversation's turns on the right. The list rows are real <button>s with the
 * delete affordance as a SIBLING (absolutely positioned) — nesting a button in
 * a button is invalid HTML and left the rows unreachable by keyboard. Styling
 * reuses the app's glass language (veil modal + black/20 wells + hairline hover
 * wash) instead of the shadcn accent surface.
 */
export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { t } = useI18n()
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [selected, setSelected] = useState<ConversationRecord | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const openRequestRef = useRef(0)

  // The dialog renders in a portal outside the header's lift rect, so it holds
  // its own lift while open: with passthrough on, it must be clickable even if
  // the pointer never crosses the header.
  const lift = usePassthroughLift({ hold: open, pad: 0 })

  const refreshList = useCallback(async () => {
    setSummaries(await window.api.listConversations())
  }, [])

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setPendingDeleteId(null)
    void refreshList()
  }, [open, refreshList])

  const handleOpenSummary = async (id: string) => {
    // Out-of-order guard: two fast clicks race two getConversation invokes and
    // the responses have no ordering guarantee — only the latest may land.
    const requestId = ++openRequestRef.current
    try {
      const record = await window.api.getConversation(id)
      if (requestId !== openRequestRef.current) return
      if (record) setSelected(record)
      else toast.error(t('history.loadFailed'))
    } catch {
      if (requestId === openRequestRef.current) toast.error(t('history.loadFailed'))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await window.api.deleteConversation(pendingDeleteId)
    setPendingDeleteId(null)
    setSelected(null)
    await refreshList()
  }

  const pendingTitle = summaries.find((summary) => summary.id === pendingDeleteId)?.title

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={lift.ref}
        className="flex h-[min(80vh,560px)] flex-col overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{t('history.title')}</DialogTitle>
          <DialogDescription>{t('history.textOnlyNote')}</DialogDescription>
        </DialogHeader>

        {summaries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <History className="size-8 text-ink-ghost" />
            <div className="text-sm text-muted-foreground">{t('history.empty')}</div>
            <div className="text-xs text-muted-foreground/70">{t('history.emptyHint')}</div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-3">
            {/* Master: conversation list */}
            <div className="scroll-quiet flex w-2/5 min-w-0 flex-col gap-1 overflow-y-auto pr-1">
              {summaries.map((summary) => {
                const active = selected?.id === summary.id
                return (
                  <div key={summary.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => void handleOpenSummary(summary.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full rounded-lg py-2 pl-3 pr-10 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                        active ? 'bg-hairline' : 'hover:bg-hairline/60'
                      }`}
                    >
                      <div className="truncate text-sm text-foreground">{summary.title}</div>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        {formatDateTime(summary.updatedAt)} ·{' '}
                        {t('history.turnCount', { n: summary.turnCount })}
                      </div>
                    </button>
                    <button
                      type="button"
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      onClick={() => setPendingDeleteId(summary.id)}
                      className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-ghost opacity-0 outline-none transition-colors hover:bg-bad/15 hover:text-bad-soft focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Detail: the selected conversation, or a quiet prompt */}
            <div className={`flex min-w-0 flex-1 flex-col rounded-lg ${GLASS_WELL}`}>
              {selected ? (
                <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {selected.title}
                    </h3>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {formatDateTime(selected.updatedAt)}
                    </span>
                  </div>
                  {selected.turns.map((turn, index) => (
                    <div key={index} className="mb-4 last:mb-0">
                      {/* The question is user input: MathText interprets only
                          $…$ so a typed formula reads as math, while a leading
                          "#" or "-" stays literal instead of becoming markdown. */}
                      <div className="mb-1 text-xs font-medium whitespace-pre-wrap text-live-soft">
                        <MathText>{turn.question}</MathText>
                      </div>
                      <MarkdownRenderer>{turn.answer}</MarkdownRenderer>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
                  <History className="size-6 text-ink-ghost" />
                  <div className="text-sm text-muted-foreground">{t('history.selectHint')}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inline delete confirmation: replaces the body so the record in
            question stays named and the destructive action needs one step. */}
        {pendingDeleteId && (
          <div className={`rounded-lg p-4 ${GLASS_WELL}`}>
            <p className="text-sm text-foreground">
              {t('history.deleteConfirmText')}
              {pendingTitle ? (
                <span className="mt-1 block truncate text-xs text-ink-faint">{pendingTitle}</span>
              ) : null}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                className="h-9 px-3"
                onClick={() => setPendingDeleteId(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                className="h-9 px-3"
                onClick={() => void confirmDelete()}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
