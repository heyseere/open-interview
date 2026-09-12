import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { useI18n } from '@/lib/i18n'

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

export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { t } = useI18n()
  const [summaries, setSummaries] = useState<ConversationSummary[]>([])
  const [selected, setSelected] = useState<ConversationRecord | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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
    try {
      const record = await window.api.getConversation(id)
      if (record) setSelected(record)
      else toast.error(t('history.loadFailed'))
    } catch {
      toast.error(t('history.loadFailed'))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    await window.api.deleteConversation(pendingDeleteId)
    setPendingDeleteId(null)
    setSelected(null)
    await refreshList()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('history.title')}</DialogTitle>
          <DialogDescription>{t('history.textOnlyNote')}</DialogDescription>
        </DialogHeader>

        {pendingDeleteId ? (
          <div className="py-4">
            <p className="text-sm">{t('history.deleteConfirmText')}</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col min-h-0 flex-1 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="self-start h-7 px-2 text-xs"
              onClick={() => setSelected(null)}
            >
              ← {t('history.title')}
            </Button>
            <div className="overflow-y-auto min-h-0 pr-1">
              {selected.turns.map((turn, index) => (
                <div key={index} className="mb-4">
                  <div className="text-xs text-blue-600 font-medium mb-1 whitespace-pre-wrap">
                    {turn.question}
                  </div>
                  <MarkdownRenderer>{turn.answer}</MarkdownRenderer>{' '}
                </div>
              ))}
            </div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">{t('history.empty')}</div>
        ) : (
          <div className="overflow-y-auto min-h-0 pr-1">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-200/60 cursor-pointer transition-colors"
                onClick={() => void handleOpenSummary(summary.id)}
              >
                <div className="min-w-0">
                  <div className="text-sm truncate">{summary.title}</div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(summary.updatedAt)} ·{' '}
                    {t('history.turnCount', { n: summary.turnCount })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingDeleteId(summary.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
