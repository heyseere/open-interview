import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/Chip'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { isModifierKey, getShortcutAccelerator } from '@/lib/utils/keyboard'
import { getMouseButtonAccelerator } from '@/lib/utils/keyboard'
import {
  SHORTCUT_ACTION_META,
  SHORTCUT_CATEGORIES,
  SHORTCUT_CATEGORY_LABEL_KEYS,
  ShortcutStatus,
  useShortcutsStore
} from '@/lib/store/shortcuts'
import { useI18n } from '@/lib/i18n'

const ShortcutsContext = createContext<{
  recordingAction: string | null
  setRecordingAction: (action: string | null) => void
}>({
  recordingAction: null,
  setRecordingAction: () => {}
})

export function CustomShortcuts() {
  const { t } = useI18n()
  const { shortcuts, updateShortcut } = useShortcutsStore()
  const [recordingAction, setRecordingAction] = useState<string | null>(null)

  const onShortcutChange = useCallback(
    (action: string, key: string) => {
      // Refuse a key that is already bound to another action: Electron would
      // silently fail to register it AND the re-register first tore down the
      // action's old binding, leaving the action dead with no feedback
      const conflict = Object.entries(shortcuts).find(
        ([otherAction, shortcut]) => otherAction !== action && shortcut.key === key
      )
      if (conflict) {
        toast.error(t('shortcuts.conflict'))
        return
      }
      const newShortcut = { ...shortcuts[action], key }
      updateShortcut(action, newShortcut)
      void window.api.updateShortcuts([newShortcut]).then((report) => {
        useShortcutsStore.getState().applyRegistration(report)
        if (report[action] === ShortcutStatus.Failed) {
          toast.error(t('shortcuts.occupied'))
        }
      })
    },
    [shortcuts, updateShortcut, t]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return

      e.preventDefault()

      if (isModifierKey(e.code)) return
      const accelerator = getShortcutAccelerator(e)
      // User press escape to cancel recording.
      if (e.code === 'Escape' && !accelerator) {
        setRecordingAction(null)
      }
      if (!accelerator) return
      onShortcutChange(recordingAction, accelerator)
      setRecordingAction(null)
    },
    [recordingAction, onShortcutChange]
  )

  // Mouse middle/side buttons can be bound too: a press is recorded as a
  // "Mouse3"/"Mouse4"/"Mouse5" accelerator token (middle / side back / side
  // forward). Left and right clicks are deliberately not bindable.
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!recordingAction) return
      const accelerator = getMouseButtonAccelerator(e.button)
      if (!accelerator) return
      e.preventDefault()
      onShortcutChange(recordingAction, accelerator)
      setRecordingAction(null)
    },
    [recordingAction, onShortcutChange]
  )

  useEffect(() => {
    if (!recordingAction) return
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [recordingAction, handleKeyDown, handleMouseDown])

  return (
    <ShortcutsContext.Provider value={{ recordingAction, setRecordingAction }}>
      <div className="space-y-4">
        {SHORTCUT_CATEGORIES.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm text-muted-foreground">
              {t(SHORTCUT_CATEGORY_LABEL_KEYS[category])}
            </h3>
            {Object.values(shortcuts)
              .filter((shortcut) => shortcut.category === category)
              .map((shortcut) => {
                const meta = SHORTCUT_ACTION_META[shortcut.action]
                return (
                  <Shortcut
                    key={shortcut.action}
                    label={meta ? t(meta.labelKey) : shortcut.action}
                    description={meta?.hintKey ? t(meta.hintKey) : undefined}
                    shortcut={shortcut.action}
                  />
                )
              })}
          </div>
        ))}
      </div>
    </ShortcutsContext.Provider>
  )
}

function Shortcut({
  label,
  description,
  shortcut: shortcutAction,
  disabled
}: {
  label: string
  description?: string
  shortcut: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  const { shortcuts } = useShortcutsStore()
  const { recordingAction, setRecordingAction } = useContext(ShortcutsContext)
  const shortcut = shortcuts[shortcutAction]
  const isRecording = recordingAction === shortcutAction
  // `failed` means the OS refused the combination because another app (or the
  // system) already owns it — the only conflict signal Electron exposes.
  const occupied = shortcut?.status === ShortcutStatus.Failed

  return shortcut ? (
    <div
      className={`flex items-center justify-between${disabled ? ' opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {occupied && !isRecording && (
          <StatusChip tone="warn" title={t('shortcuts.occupiedHint')}>
            <AlertTriangle className="size-3" />
            {t('shortcuts.occupied')}
          </StatusChip>
        )}
      </div>
      <span
        className="shrink-0 cursor-pointer"
        onClick={() => setRecordingAction(isRecording ? null : shortcutAction)}
      >
        {!isRecording ? (
          <span className={occupied ? 'opacity-70' : undefined}>
            <ShortcutRenderer shortcut={shortcut.key} />
          </span>
        ) : (
          // Low-key recording state: a dashed outline instead of a highlighted pill
          <span className="font-mono text-sm align-middle rounded-md px-2 py-1 border border-dashed border-hairline-2 text-ink-faint">
            {t('shortcuts.recording')}
          </span>
        )}
      </span>
    </div>
  ) : null
}

export function ResetDefaultShortcuts() {
  const { t } = useI18n()
  const { shortcuts, resetShortcuts } = useShortcutsStore()
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const report = await window.api.updateShortcuts(
          Object.values(shortcuts)
            .filter(({ key, defaultKey }) => key !== defaultKey)
            .map((shortcut) => ({
              ...shortcut,
              key: shortcut.defaultKey
            }))
        )
        resetShortcuts()
        useShortcutsStore.getState().applyRegistration(report)
        toast.success(t('shortcuts.resetSuccess'))
      }}
    >
      {t('shortcuts.resetAction')}
    </Button>
  )
}
