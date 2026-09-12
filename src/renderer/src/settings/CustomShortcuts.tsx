import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { isModifierKey, getShortcutAccelerator } from '@/lib/utils/keyboard'
import { getMouseButtonAccelerator } from '@/lib/utils/keyboard'
import { useShortcutsStore } from '@/lib/store/shortcuts'
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
      const newShortcut = { ...shortcuts[action], key }
      updateShortcut(action, newShortcut)
      window.api.updateShortcuts([newShortcut])
    },
    [shortcuts, updateShortcut]
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
        {/* Window Management */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">{t('shortcuts.windowManagement')}</h3>
          <Shortcut label={t('shortcuts.hideOrShow')} shortcut="hideOrShowMainWindow" />
          <Shortcut
            label={t('shortcuts.mousePassThrough')}
            description={t('shortcuts.mousePassThroughDesc')}
            shortcut="ignoreOrEnableMouse"
          />
        </div>

        {/* Screenshot & AI */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">{t('shortcuts.screenshotAndAi')}</h3>
          <Shortcut
            label={t('shortcuts.takeScreenshot')}
            description={t('shortcuts.takeScreenshotDesc')}
            shortcut="takeScreenshot"
          />
          <Shortcut
            label={t('shortcuts.appendScreenshot')}
            description={t('shortcuts.appendScreenshotDesc')}
            shortcut="appendScreenshot"
          />
          <Shortcut
            label={t('shortcuts.stopGenerating')}
            description={t('shortcuts.stopGeneratingDesc')}
            shortcut="stopSolutionStream"
          />
          <Shortcut
            label={t('shortcuts.followUpQuestion')}
            description={t('shortcuts.followUpQuestionDesc')}
            shortcut="followUpQuestion"
          />
          <Shortcut
            label={t('shortcuts.toggleTranscription')}
            description={t('shortcuts.toggleTranscriptionDesc')}
            shortcut="toggleTranscription"
          />
          <Shortcut
            label={t('shortcuts.clearTranscription')}
            description={t('shortcuts.clearTranscriptionDesc')}
            shortcut="clearTranscription"
          />
        </div>

        {/* Navigation */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">{t('shortcuts.navigation')}</h3>
          <Shortcut label={t('shortcuts.pageUp')} shortcut="pageUp" />
          <Shortcut label={t('shortcuts.pageDown')} shortcut="pageDown" />
        </div>

        {/* Window Movement */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">{t('shortcuts.windowMovement')}</h3>
          <Shortcut label={t('shortcuts.moveUp')} shortcut="moveMainWindowUp" />
          <Shortcut label={t('shortcuts.moveDown')} shortcut="moveMainWindowDown" />
          <Shortcut label={t('shortcuts.moveLeft')} shortcut="moveMainWindowLeft" />
          <Shortcut label={t('shortcuts.moveRight')} shortcut="moveMainWindowRight" />
        </div>
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

  return shortcut ? (
    <div
      className={`flex items-center justify-between${disabled ? ' opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs font-light">{description}</p>}
      </div>
      <span
        className="cursor-pointer"
        onClick={() => setRecordingAction(isRecording ? null : shortcutAction)}
      >
        {!isRecording ? (
          <ShortcutRenderer shortcut={shortcut.key} variant="light" />
        ) : (
          // Low-key recording state: a dashed outline instead of a highlighted pill
          <span className="font-mono text-sm align-middle rounded-md px-2 py-1 border border-dashed border-gray-500 text-gray-400">
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
      size="sm"
      className="ml-auto"
      onClick={async () => {
        await window.api.updateShortcuts(
          Object.values(shortcuts)
            .filter(({ key, defaultKey }) => key !== defaultKey)
            .map((shortcut) => ({
              ...shortcut,
              key: shortcut.defaultKey
            }))
        )
        resetShortcuts()
        toast.success(t('shortcuts.resetSuccess'))
      }}
    >
      {t('shortcuts.resetAction')}
    </Button>
  )
}
