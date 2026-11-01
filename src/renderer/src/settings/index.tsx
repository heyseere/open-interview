import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import {
  SquareTerminal,
  Palette,
  Bot,
  Check,
  Keyboard,
  ListChecks,
  Loader2,
  FolderOpen,
  Mic,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  Pencil,
  Wifi
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { BusyButton, PromptDialog, SettingsRow, SettingsStepper } from './components'
import { Chip, StatusChip } from '@/components/Chip'
import { PageShell } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Well } from '@/components/Well'
import { ProviderFields, ProviderSwitcher } from './ProviderSection'
import { ToolbarButtonsRow } from './ToolbarButtonsRow'
import { cn } from '@/lib/utils'
import {
  useSettingsStore,
  activeProviderOf,
  PRESET_SCENE_PROMPTS,
  sceneDisplayName,
  LOCAL_ASR_MODEL_SIZES,
  LOCAL_ASR_LANGUAGES,
  ANSWER_FONT_SIZES,
  TOOLBAR_DWELL_MIN,
  TOOLBAR_DWELL_MAX,
  TOOLBAR_DWELL_STEP,
  REASONING_EFFORTS,
  normalizeToolbarDwellMs,
  type AnswerFontSize,
  type Language,
  type LocalAsrLanguage,
  type LocalAsrModelSize,
  type ReasoningEffort
} from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'
import { sampleTranscription } from '@/lib/transcription-control'

/** Shape returned by the local ASR status IPC (kept in sync with main). */
type LocalAsrStatus = Awaited<ReturnType<typeof window.api.localAsrStatus>>

/**
 * Select value for the 系统音频 entry (stored as ''). Must never collide with
 * a real Chromium deviceId — Chromium itself uses the literal 'default' (and
 * Windows 'communications') for pseudo-devices, so use a reserved prefix.
 */
const SYSTEM_AUDIO_VALUE = '__system-audio__'

/** Stage → i18n key for the setup progress label. */
const LOCAL_SETUP_STAGE_KEYS: Record<string, TranslationKey> = {
  engine: 'settings.localSetupStageEngine',
  model: 'settings.localSetupStageModel'
}

/** Recognition language → i18n key for the local engine select. */
const LOCAL_LANGUAGE_LABEL_KEYS: Record<LocalAsrLanguage, TranslationKey> = {
  auto: 'settings.localLanguageAuto',
  zh: 'settings.localLanguageZh',
  en: 'settings.localLanguageEn'
}

/** Answer font size → i18n key for the appearance select. */
const ANSWER_FONT_LABEL_KEYS: Record<AnswerFontSize, TranslationKey> = {
  small: 'settings.answerFontSmall',
  medium: 'settings.answerFontMedium',
  large: 'settings.answerFontLarge'
}

/** Deep-thinking effort → i18n key for the reasoning select. */
const REASONING_EFFORT_LABEL_KEYS: Record<ReasoningEffort, TranslationKey> = {
  off: 'settings.reasoningOff',
  low: 'settings.reasoningLow',
  medium: 'settings.reasoningMedium',
  high: 'settings.reasoningHigh'
}

/** Engine provenance shown next to the CLI row's "ready" state. */
const LOCAL_CLI_SOURCE_KEYS: Record<NonNullable<LocalAsrStatus['cliSource']>, TranslationKey> = {
  brew: 'settings.localStatusCliBrew',
  winget: 'settings.localStatusCliWinget',
  downloaded: 'settings.localStatusCliDownloaded',
  path: 'settings.localStatusCliPath'
}

/** One row of the local ASR environment status card. */
function StatusRow({
  label,
  ok,
  pending,
  detail,
  okLabel
}: {
  label: string
  ok: boolean
  pending: boolean
  detail?: string
  okLabel: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span>{label}</span>
      {pending ? (
        <Loader2 className="size-3.5 text-ink-faint animate-spin" />
      ) : ok ? (
        <StatusChip tone="ok">
          <Check className="size-3" />
          {okLabel}
          {detail && <span className="font-normal opacity-70">{detail}</span>}
        </StatusChip>
      ) : (
        <StatusChip tone="warn">{detail}</StatusChip>
      )}
    </div>
  )
}

/**
 * Shared judgment behind the two local-ASR status cards, so "what is missing"
 * is worded in exactly one place:
 * - `cli` — the engine card's CLI row: found or not, plus the missing-CLI
 *   message (the card adds the provenance label for a found engine itself).
 * - `model` — the engine card's model row ok flag.
 * - `ready` — the readiness card's combined row: ready only when the CLI is
 *   found AND the model is cached, naming whichever piece is missing.
 * (The model row's download check stays at its call site: it judges the size
 * selected in the UI via `cachedModels`, not the size the status was fetched
 * for via `modelCached` — the two can differ until the status refreshes.)
 */
function asrStatusRow(
  localStatus: LocalAsrStatus | null,
  t: (key: TranslationKey) => string
): {
  cli: { ok: boolean; detail?: string }
  model: { ok: boolean }
  ready: { ok: boolean; detail?: string }
} {
  const cli = {
    ok: localStatus?.cli === 'found',
    detail: localStatus?.cli === 'missing' ? t('settings.localStatusCliMissing') : undefined
  }
  const modelOk = localStatus?.modelCached === true
  const modelDetail =
    localStatus && localStatus.modelCached !== true
      ? t('settings.localModelNeedsDownload')
      : undefined
  return {
    cli,
    model: { ok: modelOk },
    ready: { ok: cli.ok && modelOk, detail: cli.detail ?? modelDetail }
  }
}

import { CustomShortcuts, ResetDefaultShortcuts } from './CustomShortcuts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export default function SettingsPage() {
  const { t } = useI18n()
  const location = useLocation()
  // useShallow field projection instead of a whole-store subscription: any
  // unrelated settings write must not re-render this long form.
  const {
    providers,
    activeProviderId,
    reasoningEffort,
    scenes,
    activeSceneId,
    opacity,
    screenshotAutoSave,
    screenshotDir,
    localAsrModelSize,
    localAsrLanguage,
    vadSilenceMs,
    language,
    answerFontSize,
    toolbarEnabled,
    toolbarHoverTrigger,
    toolbarDwellMs,
    audioInputDeviceId,
    updateSetting,
    setActiveScene,
    updateScenePrompt,
    addScene,
    renameScene,
    removeScene
  } = useSettingsStore(
    useShallow((state) => ({
      providers: state.providers,
      activeProviderId: state.activeProviderId,
      reasoningEffort: state.reasoningEffort,
      scenes: state.scenes,
      activeSceneId: state.activeSceneId,
      opacity: state.opacity,
      screenshotAutoSave: state.screenshotAutoSave,
      screenshotDir: state.screenshotDir,
      localAsrModelSize: state.localAsrModelSize,
      localAsrLanguage: state.localAsrLanguage,
      vadSilenceMs: state.vadSilenceMs,
      language: state.language,
      answerFontSize: state.answerFontSize,
      toolbarEnabled: state.toolbarEnabled,
      toolbarHoverTrigger: state.toolbarHoverTrigger,
      toolbarDwellMs: state.toolbarDwellMs,
      audioInputDeviceId: state.audioInputDeviceId,
      updateSetting: state.updateSetting,
      setActiveScene: state.setActiveScene,
      updateScenePrompt: state.updateScenePrompt,
      addScene: state.addScene,
      renameScene: state.renameScene,
      removeScene: state.removeScene
    }))
  )
  // Deep-thinking support is whatever the model list detection reports, but it
  // is a HINT only: the control stays selectable for every model because most
  // providers publish no reasoning metadata at all.
  const activeProvider = activeProviderOf({ providers, activeProviderId })
  const reasoningDetected = Boolean(
    activeProvider?.model && activeProvider.reasoningModelIds.includes(activeProvider.model)
  )
  const reasoningHint = reasoningDetected
    ? t('settings.reasoningHint')
    : t('settings.reasoningUnknownHint')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<{
    ok: boolean
    text: string
  } | null>(null)
  const [addSceneOpen, setAddSceneOpen] = useState(false)
  const [newSceneName, setNewSceneName] = useState('')
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null)
  const [renameSceneId, setRenameSceneId] = useState<string | null>(null)
  const [renameSceneName, setRenameSceneName] = useState('')
  // Scene prompts are saved explicitly (Save button), not per keystroke:
  // drafts live per scene id so switching scenes keeps unsaved edits around.
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({})

  // Local ASR: setup job progress + environment status
  const [isSettingUpLocal, setIsSettingUpLocal] = useState(false)
  const [localSetupStage, setLocalSetupStage] = useState<string | null>(null)
  const [localSetupMessage, setLocalSetupMessage] = useState('')
  const [localStatus, setLocalStatus] = useState<LocalAsrStatus | null>(null)
  const [setupErrorCode, setSetupErrorCode] = useState<'brew-missing' | null>(null)
  const [isVerifyingLocal, setIsVerifyingLocal] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)
  // OS permission snapshot for the readiness card (microphone / screen).
  const [permStatus, setPermStatus] = useState<{ microphone: string; screen: string } | null>(null)

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const deletingScene = scenes.find((s) => s.id === sceneToDelete)
  const promptDraft = activeScene ? (promptDrafts[activeScene.id] ?? activeScene.prompt) : ''
  const promptDirty = Boolean(activeScene) && promptDraft !== activeScene?.prompt
  const permsOk = permStatus?.microphone === 'granted' && permStatus?.screen === 'granted'
  // One ASR judgment shared by the readiness card and the engine status card.
  const asrStatus = asrStatusRow(localStatus, t)

  const clearPromptDraft = (sceneId: string) => {
    setPromptDrafts((prev) => {
      if (!(sceneId in prev)) return prev
      const next = { ...prev }
      delete next[sceneId]
      return next
    })
  }

  const [appInfo, setAppInfo] = useState<{ isPackaged: boolean } | null>(null)

  useEffect(() => {
    window.api
      .getAppInfo()
      .then((info) => setAppInfo({ isPackaged: info.isPackaged }))
      .catch(() => setAppInfo(null))
  }, [])

  // Deep link from the help page ("open shortcut settings"): scroll the
  // shortcuts card into view instead of dropping the user at the top.
  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (section !== 'shortcuts') return
    const element = document.getElementById('shortcuts-section')
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.state])

  // Probing device labels requires opening the microphone, which triggers a
  // TCC prompt. Only a packaged app can own that prompt (in dev macOS would
  // attribute it to the terminal), so auto-probe is packaged-only and the
  // explicit refresh button covers the rest.
  const loadAudioDevices = useCallback(async (probeLabels: boolean) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const needsPermission = probeLabels && devices.every((d) => !d.label)
      if (needsPermission) {
        // Release the probe right away — an open track keeps the macOS mic
        // indicator lit even though nothing is recording.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        probe.getTracks().forEach((track) => track.stop())
      }
      const refreshed = await navigator.mediaDevices.enumerateDevices()
      setAudioDevices(refreshed)
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err)
    }
  }, [])

  useEffect(() => {
    if (appInfo === null) return
    void loadAudioDevices(appInfo.isPackaged)
  }, [appInfo, loadAudioDevices])

  const handleAddScene = () => {
    const name = newSceneName.trim()
    if (!name) return
    addScene(name)
    setNewSceneName('')
    setAddSceneOpen(false)
  }

  const handleResetScenePrompt = () => {
    if (!activeScene?.isPreset) return
    // Fill the draft with the built-in prompt; saving is still explicit so
    // the change can be undone like any other edit.
    const fallback = PRESET_SCENE_PROMPTS[activeScene.id] ?? ''
    setPromptDrafts((prev) => ({ ...prev, [activeScene.id]: fallback }))
  }

  const handleSaveScenePrompt = () => {
    if (!activeScene || !promptDirty) return
    updateScenePrompt(activeScene.id, promptDraft)
    clearPromptDraft(activeScene.id)
    toast.success(t('settings.promptSaved'))
  }

  const handleRenameScene = () => {
    if (!renameSceneId || !renameSceneName.trim()) return
    const ok = renameScene(renameSceneId, renameSceneName.trim())
    if (!ok) {
      toast.error(t('settings.renameFailed'))
      return
    }
    setRenameSceneId(null)
    setRenameSceneName('')
  }

  const refreshLocalStatus = useCallback(async () => {
    try {
      const status = await window.api.localAsrStatus(useSettingsStore.getState().localAsrModelSize)
      setLocalStatus(status)
      return status
    } catch {
      // Status is best-effort; the setup flow surfaces real errors
      return null
    }
  }, [])

  const refreshPermStatus = useCallback(async () => {
    try {
      setPermStatus(await window.api.getMediaPermissionStatus())
    } catch {
      // Best-effort; the permission center surfaces real errors
    }
  }, [])

  useEffect(() => {
    void refreshLocalStatus().then((status) => {
      // Re-entering the page while a setup job is still running (the user
      // navigated away and back): flip the button back to its cancel state
      // and let the progress listener below resume the live stage display.
      if (status?.setupRunning) setIsSettingUpLocal(true)
    })
    void refreshPermStatus()
    // Returning from System Settings (granting a permission) must refresh
    // without a manual reload.
    const onfocus = () => {
      void refreshPermStatus()
    }
    window.addEventListener('focus', onfocus)
    window.api.onLocalAsrSetupProgress((progress) => {
      setLocalSetupStage(progress.stage)
      if (progress.message) setLocalSetupMessage(progress.message)
      setSetupErrorCode(progress.status === 'error' ? (progress.code ?? null) : null)
      if (progress.stage === 'done' && progress.status === 'ok') {
        setIsSettingUpLocal(false)
        setLocalSetupStage(null)
        setLocalSetupMessage('')
        toast.success(t('settings.localSetupDone'))
        void refreshLocalStatus()
      }
      if (progress.status === 'error') {
        // Keep the stage/message visible; the final invoke result ends the run
      }
    })
    return () => {
      window.removeEventListener('focus', onfocus)
      window.api.removeLocalAsrSetupProgressListener()
    }
  }, [refreshLocalStatus, refreshPermStatus, t])

  const handleSetupLocalAsr = async () => {
    setIsSettingUpLocal(true)
    setLocalSetupMessage('')
    try {
      const result = await window.api.setupLocalAsr(localAsrModelSize)
      if (result.ok) {
        setLocalSetupStage(null)
        setLocalSetupMessage('')
      } else {
        setLocalSetupMessage(
          result.cancelled ? t('settings.localSetupCancelled') : (result.message ?? '')
        )
        if (!result.cancelled) toast.error(result.message || t('settings.localSetupFailed'))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLocalSetupMessage(message)
      toast.error(message)
    } finally {
      setIsSettingUpLocal(false)
      setLocalSetupStage(null)
      void refreshLocalStatus()
    }
  }

  const handleCancelLocalSetup = () => {
    void window.api.cancelLocalAsrSetup()
  }

  /** True when switching to the selected size would need a download. */
  const modelNeedsDownload =
    localStatus !== null && !localStatus.cachedModels.includes(localAsrModelSize)

  const handleVerifyLocalAsr = async () => {
    setIsVerifyingLocal(true)
    setVerifyResult(null)
    try {
      const text = await sampleTranscription(3)
      setVerifyResult(text || t('settings.localVerifyNoSpeech'))
      if (text) toast.success(t('settings.localVerifyDone'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setVerifyResult(message)
      toast.error(message)
    } finally {
      setIsVerifyingLocal(false)
    }
  }

  /** One-shot connectivity check against the configured provider. */
  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setConnectionTestResult(null)
    try {
      const result = await window.api.testAiConnection()
      const text = result.ok
        ? t('settings.testConnectionOk')
        : t('settings.testConnectionFail', { error: result.error ?? '' })
      setConnectionTestResult({ ok: result.ok, text })
      if (result.ok) {
        toast.success(t('settings.testConnectionOk'))
      } else {
        toast.error(text)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setConnectionTestResult({ ok: false, text: message })
      toast.error(message)
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <PageShell title={t('settings.title')}>
      {/* Readiness at a glance: the three things every feature needs, checked
          live. A warn row names its fix in place — the provider and ASR cards
          are further down this same page; only permissions route to the
          dedicated center (which refreshes itself on window focus). */}
      <SectionCard icon={ListChecks} title={t('settings.readinessTitle')}>
        <Well className="divide-y divide-hairline text-sm">
          <StatusRow
            label={t('settings.readinessProvider')}
            ok={Boolean(activeProvider?.baseURL && activeProvider?.model)}
            pending={false}
            okLabel={t('settings.localStatusOk')}
            detail={
              activeProvider?.baseURL && activeProvider?.model
                ? activeProvider.model
                : t('settings.readinessProviderMissing')
            }
          />
          <StatusRow
            label={t('settings.readinessAsr')}
            ok={asrStatus.ready.ok}
            pending={!localStatus}
            okLabel={t('settings.localStatusOk')}
            detail={asrStatus.ready.detail}
          />
          <StatusRow
            label={t('settings.readinessPermissions')}
            ok={permsOk}
            pending={!permStatus}
            okLabel={t('settings.localStatusOk')}
            detail={permStatus && !permsOk ? t('settings.readinessPermissionsMissing') : undefined}
          />
        </Well>
        {permStatus && !permsOk && (
          <div className="mt-2">
            <Button variant="outline" asChild>
              <Link to="/permissions">{t('permission.openCenter')}</Link>
            </Button>
          </div>
        )}
      </SectionCard>

      {/* AI Settings */}
      <SectionCard icon={Bot} title={t('settings.aiSection')}>
        <ProviderSwitcher />
        <ProviderFields />

        {/* Deep thinking: ALWAYS selectable. The model-list detection only
              changes the hint — most providers publish no reasoning metadata,
              so locking the control on detection is what made it feel broken. */}
        <SettingsRow label={t('settings.reasoningLabel')} hint={reasoningHint}>
          <Select
            value={reasoningEffort}
            onValueChange={(val) => updateSetting('reasoningEffort', val as ReasoningEffort)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONING_EFFORTS.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {t(REASONING_EFFORT_LABEL_KEYS[effort])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        {/* One-shot connectivity check: the #1 onboarding failure is a
              mis-typed Base URL / Key / model, which otherwise only shows up
              when the first screenshot fails */}
        <SettingsRow
          label={t('settings.testConnectionLabel')}
          hint={t('settings.testConnectionHint')}
        >
          <div className="flex w-60 items-center justify-end gap-2">
            {connectionTestResult && (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-right text-xs',
                  connectionTestResult.ok ? 'text-good' : 'text-bad-soft'
                )}
                title={connectionTestResult.text}
              >
                {connectionTestResult.text}
              </span>
            )}
            <BusyButton
              busy={isTestingConnection}
              icon={Wifi}
              disabled={isTestingConnection}
              onClick={() => void handleTestConnection()}
            >
              {t('settings.testConnectionAction')}
            </BusyButton>
          </div>
        </SettingsRow>
      </SectionCard>
      {/* Transcription Settings */}
      <SectionCard icon={Mic} title={t('settings.transcriptionSection')}>
        {/* System permission center entry (screen recording / microphone) */}
        <SettingsRow label={t('permission.entry')} hint={t('permission.entryHint')}>
          <Button variant="outline" asChild>
            <Link to="/permissions">{t('permission.openCenter')}</Link>
          </Button>
        </SettingsRow>

        {/* Recognition language for the local whisper.cpp engine */}
        <SettingsRow
          label={t('settings.localLanguageLabel')}
          hint={t('settings.localLanguageHint')}
        >
          <Select
            value={localAsrLanguage}
            onValueChange={(val) => updateSetting('localAsrLanguage', val as LocalAsrLanguage)}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCAL_ASR_LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {t(LOCAL_LANGUAGE_LABEL_KEYS[lang])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        {/* Local whisper.cpp engine: model size + environment status */}
        <SettingsRow
          stacked
          label={t('settings.localModelLabel')}
          hint={t('settings.localModelHint')}
        >
          {/* Environment status card */}
          <Well className="mt-2 divide-y divide-hairline text-sm">
            <StatusRow
              label={t('settings.localStatusCli')}
              ok={asrStatus.cli.ok}
              okLabel={t('settings.localStatusOk')}
              pending={!localStatus}
              detail={
                asrStatus.cli.detail ??
                (localStatus
                  ? t(LOCAL_CLI_SOURCE_KEYS[localStatus.cliSource ?? 'path'])
                  : undefined)
              }
            />
            <StatusRow
              label={`${t('settings.localStatusModel')} · ${localAsrModelSize}`}
              ok={asrStatus.model.ok}
              okLabel={t('settings.localStatusOk')}
              pending={!localStatus}
              detail={modelNeedsDownload ? t('settings.localModelNeedsDownload') : undefined}
            />
          </Well>

          {localStatus && localStatus.cachedModels.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t('settings.localStatusCachedOthers')}：</span>
              {localStatus.cachedModels.map((size) => (
                <Chip key={size} onClick={() => updateSetting('localAsrModelSize', size)}>
                  {size}
                </Chip>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Select
              value={localAsrModelSize}
              onValueChange={(val) => updateSetting('localAsrModelSize', val as LocalAsrModelSize)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCAL_ASR_MODEL_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSettingUpLocal ? (
              <Button
                variant="outline"
                className="px-3 whitespace-nowrap"
                onClick={handleCancelLocalSetup}
              >
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                {t('settings.localSetupCancel')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="px-3 whitespace-nowrap"
                onClick={() => void handleSetupLocalAsr()}
              >
                {t('settings.localSetupAction')}
              </Button>
            )}

            {!isSettingUpLocal && (
              <BusyButton
                busy={isVerifyingLocal}
                icon={Mic}
                disabled={isVerifyingLocal}
                title={t('settings.localVerifyHint')}
                onClick={() => void handleVerifyLocalAsr()}
              >
                {t('settings.localVerifyAction')}
              </BusyButton>
            )}

            {isSettingUpLocal && localSetupStage && (
              <div className="ml-2 min-w-0">
                <div className="text-xs font-medium">
                  {t(LOCAL_SETUP_STAGE_KEYS[localSetupStage] ?? 'settings.localSetupAction')}
                </div>
                {localSetupMessage && (
                  <div className="text-xs text-muted-foreground truncate max-w-md">
                    {localSetupMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isSettingUpLocal && localSetupMessage && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-bad-soft max-w-xl break-all">{localSetupMessage}</span>
              {setupErrorCode === 'brew-missing' && (
                <Button
                  variant="outline"
                  className="h-7 px-2.5 whitespace-nowrap"
                  onClick={() => void window.api.openExternalUrl('https://brew.sh')}
                >
                  {t('settings.openBrewSite')}
                </Button>
              )}
            </div>
          )}

          {verifyResult && !isSettingUpLocal && (
            <div className="mt-2 text-xs text-muted-foreground max-w-xl break-words">
              {t('settings.localVerifyResult')}：{verifyResult}
            </div>
          )}
        </SettingsRow>

        {/* Silence length before VAD auto-submit fires. The on/off switch
              itself lives on the toolbar (Timer button) — the only place it
              belongs, next to the mic button it works with. */}
        <SettingsRow label={t('settings.vadSilenceLabel')} hint={t('settings.vadSilenceHint')}>
          <Select
            value={String(vadSilenceMs)}
            onValueChange={(val) => updateSetting('vadSilenceMs', Number(val))}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1000, 1500, 2000, 3000].map((ms) => (
                <SelectItem key={ms} value={String(ms)}>
                  {t('common.seconds', { n: ms / 1000 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label={t('settings.inputDeviceLabel')} hint={t('settings.inputDeviceHint')}>
          <div className="flex items-center gap-2">
            <Select
              value={audioInputDeviceId || SYSTEM_AUDIO_VALUE}
              onValueChange={(val) =>
                updateSetting('audioInputDeviceId', val === SYSTEM_AUDIO_VALUE ? '' : val)
              }
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t('settings.inputDevicePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {/* The empty stored value is system-audio loopback on BOTH
                      platforms (macOS uses Chromium's native loopback via
                      main-process feature flags). The sentinel must not
                      collide with Chromium's literal 'default' deviceId. */}
                <SelectItem value={SYSTEM_AUDIO_VALUE}>{t('settings.systemAudio')}</SelectItem>
                {audioDevices
                  .filter(
                    (d) =>
                      d.kind === 'audioinput' &&
                      d.deviceId !== 'default' &&
                      d.deviceId !== 'communications'
                  )
                  .map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="px-2.5 whitespace-nowrap"
              title={t('settings.refreshDevicesHint')}
              onClick={() => void loadAudioDevices(true)}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </SettingsRow>
      </SectionCard>

      {/* Solver Settings */}
      <SectionCard icon={SquareTerminal} title={t('settings.solverSection')}>
        <SettingsRow stacked label={t('settings.sceneLabel')} hint={t('settings.sceneHint')}>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {scenes.map((scene) => {
              const draft = promptDrafts[scene.id]
              const dirty = draft !== undefined && draft !== scene.prompt
              return (
                <div
                  key={scene.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'group flex items-center rounded-full border text-sm transition-colors cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    scene.id === activeSceneId
                      ? 'bg-action border-action text-white'
                      : 'bg-veil border-hairline hover:border-live'
                  )}
                  onClick={() => setActiveScene(scene.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveScene(scene.id)
                    }
                  }}
                >
                  <span className={cn('py-1 pl-3', scene.isPreset ? 'pr-3' : 'pr-1')}>
                    {sceneDisplayName(scene, t)}
                    {dirty && (
                      <span
                        className="ml-1.5 inline-block size-1.5 rounded-full bg-warn align-middle"
                        title={t('settings.promptUnsaved')}
                      />
                    )}
                  </span>
                  {!scene.isPreset && (
                    <>
                      <button
                        className="mr-0.5 p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-hairline"
                        title={t('settings.renameScene')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameSceneId(scene.id)
                          setRenameSceneName(scene.name)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="mr-1.5 p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-hairline"
                        title={t('settings.deleteScene')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSceneToDelete(scene.id)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            <Chip intent="add" size="md" onClick={() => setAddSceneOpen(true)}>
              <Plus className="size-3.5" />
              {t('settings.addSceneTitle')}
            </Chip>
          </div>
        </SettingsRow>

        {activeScene && (
          <SettingsRow
            stacked
            label={t('settings.promptLabel')}
            hint={`「${sceneDisplayName(activeScene, t)}」${t('settings.promptSceneSuffix')}`}
          >
            <Textarea
              value={promptDraft}
              onChange={(e) => {
                const value = e.target.value
                setPromptDrafts((prev) => ({ ...prev, [activeScene.id]: value }))
              }}
              placeholder={t('settings.promptPlaceholder')}
              className="w-full min-h-24 max-h-100 mt-2"
              rows={6}
            />
            <div className="mt-2 flex items-center gap-2">
              {activeScene.isPreset && (
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={t('settings.resetPrompt')}
                  onClick={handleResetScenePrompt}
                >
                  <RotateCcw className="size-3" />
                  {t('settings.resetPromptAction')}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={!promptDirty}
                  onClick={() => clearPromptDraft(activeScene.id)}
                >
                  {t('settings.promptRevert')}
                </Button>
                <Button disabled={!promptDirty} onClick={handleSaveScenePrompt}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </SettingsRow>
        )}
      </SectionCard>

      {/* Add scene dialog */}
      <PromptDialog
        open={addSceneOpen}
        onOpenChange={setAddSceneOpen}
        title={t('settings.addSceneTitle')}
        description={t('settings.addSceneDescription')}
        value={newSceneName}
        onValueChange={setNewSceneName}
        placeholder={t('settings.sceneNamePlaceholder')}
        confirmLabel={t('settings.create')}
        onConfirm={handleAddScene}
      />

      {/* Delete scene confirm dialog */}
      <Dialog open={!!sceneToDelete} onOpenChange={(open) => !open && setSceneToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.deleteSceneTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.deleteSceneDescription', {
                name: deletingScene ? sceneDisplayName(deletingScene, t) : ''
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSceneToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (sceneToDelete) removeScene(sceneToDelete)
                setSceneToDelete(null)
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename scene dialog */}
      <PromptDialog
        open={!!renameSceneId}
        onOpenChange={(open) => !open && setRenameSceneId(null)}
        title={t('settings.renameSceneTitle')}
        description={t('settings.renameSceneDescription')}
        value={renameSceneName}
        onValueChange={setRenameSceneName}
        placeholder={t('settings.sceneNamePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={handleRenameScene}
      />

      {/* Appearance Settings */}
      <SectionCard icon={Palette} title={t('settings.appearanceSection')}>
        <SettingsRow label={t('settings.languageLabel')} hint={t('settings.languageHint')}>
          <Select
            value={language}
            onValueChange={(val) => updateSetting('language', val as Language)}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">中文（简体）</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        {/* Answer text size: drives --oi-answer-font (App.tsx) consumed by
              the markdown answer and the compact panel */}
        <SettingsRow label={t('settings.answerFontLabel')} hint={t('settings.answerFontHint')}>
          <Select
            value={answerFontSize}
            onValueChange={(val) => updateSetting('answerFontSize', val as AnswerFontSize)}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ANSWER_FONT_SIZES) as AnswerFontSize[]).map((size) => (
                <SelectItem key={size} value={size}>
                  {t(ANSWER_FONT_LABEL_KEYS[size])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label={t('settings.toolbarLabel')} hint={t('settings.toolbarHint')}>
          <Switch
            checked={toolbarEnabled}
            onCheckedChange={(checked) => updateSetting('toolbarEnabled', checked)}
          />
        </SettingsRow>
        {toolbarEnabled && (
          <SettingsRow
            label={t('settings.hoverTriggerLabel')}
            hint={t('settings.hoverTriggerHint')}
          >
            <Switch
              checked={toolbarHoverTrigger}
              onCheckedChange={(checked) => updateSetting('toolbarHoverTrigger', checked)}
            />
          </SettingsRow>
        )}
        {toolbarEnabled && toolbarHoverTrigger && (
          <SettingsRow label={t('settings.dwellLabel')} hint={t('settings.dwellHint')}>
            <SettingsStepper
              value={toolbarDwellMs}
              display={t('common.seconds', { n: toolbarDwellMs / 1000 })}
              min={TOOLBAR_DWELL_MIN}
              max={TOOLBAR_DWELL_MAX}
              step={TOOLBAR_DWELL_STEP}
              normalize={normalizeToolbarDwellMs}
              onChange={(value) => updateSetting('toolbarDwellMs', value)}
              decreaseTitle={t('settings.dwellDecrease')}
              increaseTitle={t('settings.dwellIncrease')}
            />
          </SettingsRow>
        )}
        {toolbarEnabled && <ToolbarButtonsRow />}

        <SettingsRow label={t('settings.opacityLabel')} hint={t('settings.opacityHint')}>
          <div className="w-60 flex items-center gap-2">
            <span className="text-xs whitespace-nowrap">{t('settings.opacityTransparent')}</span>
            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={[opacity]}
              onValueChange={(value) => {
                updateSetting('opacity', value[0])
              }}
            />
            <span className="text-xs whitespace-nowrap">{t('settings.opacityOpaque')}</span>
          </div>
        </SettingsRow>
      </SectionCard>

      {/* Shortcuts Settings — the custom heading includes the reset button */}
      <div id="shortcuts-section">
        <SectionCard
          icon={Keyboard}
          title={t('settings.shortcutsSection')}
          description={t('settings.shortcutsHint')}
          actions={<ResetDefaultShortcuts />}
        >
          <CustomShortcuts />
        </SectionCard>
      </div>

      {/* Screenshot Save Settings */}
      <SectionCard icon={FolderOpen} title={t('settings.saveScreenshotsSection')}>
        <SettingsRow label={t('settings.autoSaveLabel')} hint={t('settings.autoSaveHint')}>
          <Switch
            checked={screenshotAutoSave}
            onCheckedChange={(checked) => updateSetting('screenshotAutoSave', checked)}
          />
        </SettingsRow>
        {screenshotAutoSave && (
          <SettingsRow label={t('settings.saveDirLabel')} hint={t('settings.saveDirHint')}>
            <button
              className="text-xs text-muted-foreground max-w-48 truncate outline-none transition-colors hover:text-foreground cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm"
              title={t('settings.saveDirAction')}
              onClick={async () => {
                const dir = await window.api.selectScreenshotDir()
                if (dir) updateSetting('screenshotDir', dir)
              }}
            >
              {screenshotDir || t('settings.saveDirDefault')}
            </button>
          </SettingsRow>
        )}
      </SectionCard>
    </PageShell>
  )
}
