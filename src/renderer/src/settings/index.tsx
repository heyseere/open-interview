import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  SquareTerminal,
  Palette,
  Shield,
  Bot,
  Check,
  Eye,
  EyeOff,
  Keyboard,
  Loader2,
  FolderOpen,
  Mic,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isMac } from '@/lib/utils/env'
import {
  useSettingsStore,
  PRESET_SCENE_PROMPTS,
  LOCAL_ASR_MODEL_SIZES,
  LOCAL_ASR_LANGUAGES,
  CHUNK_SECONDS_MIN,
  CHUNK_SECONDS_MAX,
  CHUNK_SECONDS_STEP,
  TOOLBAR_DWELL_MIN,
  TOOLBAR_DWELL_MAX,
  TOOLBAR_DWELL_STEP,
  normalizeChunkSeconds,
  normalizeToolbarDwellMs,
  type Language,
  type LocalAsrLanguage,
  type LocalAsrModelSize
} from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'
import { sampleTranscription } from '@/lib/transcription-control'

/** Shape returned by the local ASR status IPC (kept in sync with main). */
type LocalAsrStatus = Awaited<ReturnType<typeof window.api.localAsrStatus>>

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
      <span className="text-gray-700">{label}</span>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
      ) : ok ? (
        <span className="flex items-center text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5 mr-1" />
          {okLabel}
        </span>
      ) : (
        <span className="text-xs text-amber-600">{detail}</span>
      )}
    </div>
  )
}

import { SelectModel } from './SelectModel'
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
  const {
    opacity,
    apiBaseURL,
    apiKey,
    model,
    scenes,
    activeSceneId,
    screenshotAutoSave,
    screenshotDir,
    localAsrModelSize,
    localAsrLanguage,
    chunkSeconds,
    autoSubmitTranscription,
    vadSilenceMs,
    language,
    toolbarEnabled,
    toolbarDwellMs,
    audioInputDeviceId,
    privacyMode,
    updateSetting,
    setActiveScene,
    updateScenePrompt,
    addScene,
    renameScene,
    removeScene
  } = useSettingsStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [addSceneOpen, setAddSceneOpen] = useState(false)
  const [newSceneName, setNewSceneName] = useState('')
  const [sceneToDelete, setSceneToDelete] = useState<string | null>(null)
  const [renameSceneId, setRenameSceneId] = useState<string | null>(null)
  const [renameSceneName, setRenameSceneName] = useState('')

  // Local ASR: setup job progress + environment status
  const [isSettingUpLocal, setIsSettingUpLocal] = useState(false)
  const [localSetupStage, setLocalSetupStage] = useState<string | null>(null)
  const [localSetupMessage, setLocalSetupMessage] = useState('')
  const [localStatus, setLocalStatus] = useState<LocalAsrStatus | null>(null)
  const [isVerifyingLocal, setIsVerifyingLocal] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

  // The "no device selected" capture differs per platform: system-audio
  // loopback is Windows-only, macOS captures through the default microphone
  const defaultInputLabel = isMac ? t('settings.defaultMic') : t('settings.systemAudio')

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const deletingScene = scenes.find((s) => s.id === sceneToDelete)

  const [appInfo, setAppInfo] = useState<{ isPackaged: boolean } | null>(null)

  useEffect(() => {
    window.api
      .getAppInfo()
      .then((info) => setAppInfo({ isPackaged: info.isPackaged }))
      .catch(() => setAppInfo(null))
  }, [])

  // Probing device labels requires opening the microphone, which triggers a
  // TCC prompt. Only a packaged app can own that prompt (in dev macOS would
  // attribute it to the terminal), so auto-probe is packaged-only and the
  // explicit refresh button covers the rest.
  const loadAudioDevices = useCallback(async (probeLabels: boolean) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const needsPermission = probeLabels && devices.every((d) => !d.label)
      if (needsPermission) {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
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
    updateScenePrompt(activeScene.id, PRESET_SCENE_PROMPTS[activeScene.id] ?? '')
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
    } catch {
      // Status is best-effort; the setup flow surfaces real errors
    }
  }, [])

  useEffect(() => {
    void refreshLocalStatus()
    window.api.onLocalAsrSetupProgress((progress) => {
      setLocalSetupStage(progress.stage)
      if (progress.message) setLocalSetupMessage(progress.message)
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
      window.api.removeLocalAsrSetupProgressListener()
    }
  }, [refreshLocalStatus, t])

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

  return (
    <>
      {/* Header */}
      <div id="app-header" className="flex items-center">
        <div className="actions">
          <Button variant="ghost" asChild size="icon" className="w-12 mr-2 rounded-none">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
        <h1>{t('settings.title')}</h1>
      </div>

      {/* Settings Content */}
      <div id="app-content" className="flex flex-col gap-4 p-8">
        {/* AI Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            {t('settings.aiSection')}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                API Base URL
                <span className="ml-2 text-xs font-light">{t('settings.apiBaseUrlHint')}</span>
              </label>
              <input
                type="text"
                value={apiBaseURL}
                onChange={(e) => updateSetting('apiBaseURL', e.target.value)}
                className="w-60 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('settings.apiBaseUrlPlaceholder')}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex items-center w-60">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => updateSetting('apiKey', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('settings.apiKeyPlaceholder')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="border border-l-0 rounded-l-none rounded-r-md h-9 w-9 hover:border-none"
                >
                  {showApiKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Model
                <span className="ml-2 text-xs font-light">{t('settings.modelHint')}</span>
              </label>
              <SelectModel value={model} onChange={(val) => updateSetting('model', val)} />
            </div>
          </div>
        </div>
        {/* Transcription Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Mic className="h-5 w-5 mr-2" />
            {t('settings.transcriptionSection')}
          </h2>

          <div className="space-y-4">
            {/* System permission center entry (screen recording / microphone) */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('permission.entry')}
                <span className="ml-2 text-xs font-light">{t('permission.entryHint')}</span>
              </label>
              <Button variant="outline" className="bg-white" asChild>
                <Link to="/permissions">{t('permission.openCenter')}</Link>
              </Button>
            </div>

            {/* Recognition language for the local whisper.cpp engine */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.localLanguageLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.localLanguageHint')}</span>
              </label>
              <Select
                value={localAsrLanguage}
                onValueChange={(val) => updateSetting('localAsrLanguage', val as LocalAsrLanguage)}
              >
                <SelectTrigger className="w-60 bg-white">
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
            </div>

            {/* Local chunked engine: 3–10s segments in 0.5s steps */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.chunkLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.chunkHint')}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-white"
                  disabled={chunkSeconds <= CHUNK_SECONDS_MIN}
                  onClick={() =>
                    updateSetting(
                      'chunkSeconds',
                      normalizeChunkSeconds(chunkSeconds - CHUNK_SECONDS_STEP)
                    )
                  }
                  title={t('settings.chunkDecrease')}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-16 text-center text-sm font-medium">
                  {t('common.seconds', { n: chunkSeconds })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-white"
                  disabled={chunkSeconds >= CHUNK_SECONDS_MAX}
                  onClick={() =>
                    updateSetting(
                      'chunkSeconds',
                      normalizeChunkSeconds(chunkSeconds + CHUNK_SECONDS_STEP)
                    )
                  }
                  title={t('settings.chunkIncrease')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Local whisper.cpp engine: model size + environment status */}
            <div>
              <label className="text-sm font-medium">
                {t('settings.localModelLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.localModelHint')}</span>
              </label>

              {/* Environment status card */}
              <div className="mt-2 rounded-lg border border-gray-200 bg-white/60 divide-y divide-gray-200 text-sm">
                <StatusRow
                  label={t('settings.localStatusCli')}
                  ok={localStatus?.cli === 'found'}
                  okLabel={t('settings.localStatusOk')}
                  pending={!localStatus}
                  detail={
                    localStatus?.cli === 'missing' ? t('settings.localStatusCliMissing') : undefined
                  }
                />
                <StatusRow
                  label={`${t('settings.localStatusModel')} · ${localAsrModelSize}`}
                  ok={localStatus?.modelCached === true}
                  okLabel={t('settings.localStatusOk')}
                  pending={!localStatus}
                  detail={modelNeedsDownload ? t('settings.localModelNeedsDownload') : undefined}
                />
              </div>

              {localStatus && localStatus.cachedModels.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
                  <span>{t('settings.localStatusCachedOthers')}：</span>
                  {localStatus.cachedModels.map((size) => (
                    <button
                      key={size}
                      className="px-2 py-0.5 rounded-full border border-gray-300 bg-white hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
                      onClick={() => updateSetting('localAsrModelSize', size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Select
                  value={localAsrModelSize}
                  onValueChange={(val) =>
                    updateSetting('localAsrModelSize', val as LocalAsrModelSize)
                  }
                >
                  <SelectTrigger className="w-40 bg-white">
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
                    size="sm"
                    className="h-9 px-3 whitespace-nowrap"
                    onClick={handleCancelLocalSetup}
                  >
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t('settings.localSetupCancel')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 whitespace-nowrap"
                    onClick={() => void handleSetupLocalAsr()}
                  >
                    {t('settings.localSetupAction')}
                  </Button>
                )}

                {!isSettingUpLocal && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 whitespace-nowrap"
                    disabled={isVerifyingLocal}
                    title={t('settings.localVerifyHint')}
                    onClick={() => void handleVerifyLocalAsr()}
                  >
                    {isVerifyingLocal ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t('settings.localVerifyAction')}
                  </Button>
                )}

                {isSettingUpLocal && localSetupStage && (
                  <div className="ml-2 min-w-0">
                    <div className="text-xs font-medium">
                      {t(LOCAL_SETUP_STAGE_KEYS[localSetupStage] ?? 'settings.localSetupAction')}
                    </div>
                    {localSetupMessage && (
                      <div className="text-xs text-gray-500 truncate max-w-md">
                        {localSetupMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isSettingUpLocal && localSetupMessage && (
                <div className="mt-2 text-xs text-red-500 max-w-xl break-all">
                  {localSetupMessage}
                </div>
              )}

              {verifyResult && !isSettingUpLocal && (
                <div className="mt-2 text-xs text-gray-600 max-w-xl break-words">
                  {t('settings.localVerifyResult')}：{verifyResult}
                </div>
              )}
            </div>

            {/* Auto-submit on silence (VAD) */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.autoSubmitLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.autoSubmitHint')}</span>
              </label>
              <Switch
                className="scale-y-90"
                checked={autoSubmitTranscription}
                onCheckedChange={(checked) => updateSetting('autoSubmitTranscription', checked)}
              />
            </div>
            {autoSubmitTranscription && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t('settings.vadSilenceLabel')}
                  <span className="ml-2 text-xs font-light">{t('settings.vadSilenceHint')}</span>
                </label>
                <Select
                  value={String(vadSilenceMs)}
                  onValueChange={(val) => updateSetting('vadSilenceMs', Number(val))}
                >
                  <SelectTrigger className="w-60 bg-white">
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
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.inputDeviceLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.inputDeviceHint')}</span>
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={audioInputDeviceId || 'system'}
                  onValueChange={(val) =>
                    updateSetting('audioInputDeviceId', val === 'system' ? '' : val)
                  }
                >
                  <SelectTrigger className="w-52 bg-white">
                    <SelectValue placeholder={defaultInputLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{defaultInputLabel}</SelectItem>
                    {audioDevices
                      .filter((d) => d.kind === 'audioinput')
                      .map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || d.deviceId}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 whitespace-nowrap"
                  title={t('settings.refreshDevicesHint')}
                  onClick={() => void loadAudioDevices(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Solver Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <SquareTerminal className="h-5 w-5 mr-2" />
            {t('settings.solverSection')}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {t('settings.sceneLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.sceneHint')}</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={cn(
                      'group flex items-center rounded-full border text-sm transition-colors cursor-pointer select-none',
                      scene.id === activeSceneId
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 hover:border-blue-400'
                    )}
                    onClick={() => setActiveScene(scene.id)}
                  >
                    <span className={cn('py-1 pl-3', scene.isPreset ? 'pr-3' : 'pr-1')}>
                      {scene.name}
                    </span>
                    {!scene.isPreset && (
                      <>
                        <button
                          className="mr-0.5 p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/10"
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
                          className="mr-1.5 p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/10"
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
                ))}
                <button
                  className="flex items-center gap-1 rounded-full border border-dashed border-gray-400 bg-transparent px-3 py-1 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  onClick={() => setAddSceneOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('settings.addScene')}
                </button>
              </div>
            </div>

            {activeScene && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">
                    {t('settings.promptLabel')}
                    <span className="ml-2 text-xs font-light">
                      「{activeScene.name}」{t('settings.promptSceneSuffix')}
                    </span>
                  </label>
                  {activeScene.isPreset && (
                    <button
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                      title={t('settings.resetPrompt')}
                      onClick={handleResetScenePrompt}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t('settings.resetPromptAction')}
                    </button>
                  )}
                </div>
                <Textarea
                  value={activeScene.prompt}
                  onChange={(e) => updateScenePrompt(activeScene.id, e.target.value)}
                  placeholder={t('settings.promptPlaceholder')}
                  className="w-full min-h-24 max-h-100 bg-white"
                  rows={6}
                />
              </div>
            )}
          </div>
        </div>

        {/* Add scene dialog */}
        <Dialog open={addSceneOpen} onOpenChange={setAddSceneOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('settings.addSceneTitle')}</DialogTitle>
              <DialogDescription>{t('settings.addSceneDescription')}</DialogDescription>
            </DialogHeader>
            <Input
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              placeholder={t('settings.sceneNamePlaceholder')}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddScene()
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddSceneOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddScene} disabled={!newSceneName.trim()}>
                {t('settings.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete scene confirm dialog */}
        <Dialog open={!!sceneToDelete} onOpenChange={(open) => !open && setSceneToDelete(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('settings.deleteSceneTitle')}</DialogTitle>
              <DialogDescription>
                {t('settings.deleteSceneDescription', { name: deletingScene?.name ?? '' })}
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
        <Dialog open={!!renameSceneId} onOpenChange={(open) => !open && setRenameSceneId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('settings.renameSceneTitle')}</DialogTitle>
              <DialogDescription>{t('settings.renameSceneDescription')}</DialogDescription>
            </DialogHeader>
            <Input
              value={renameSceneName}
              onChange={(e) => setRenameSceneName(e.target.value)}
              placeholder={t('settings.sceneNamePlaceholder')}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameScene()
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameSceneId(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleRenameScene} disabled={!renameSceneName.trim()}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Appearance Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            {t('settings.appearanceSection')}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.languageLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.languageHint')}</span>
              </label>
              <Select
                value={language}
                onValueChange={(val) => updateSetting('language', val as Language)}
              >
                <SelectTrigger className="w-60 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">中文（简体）</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.toolbarLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.toolbarHint')}</span>
              </label>
              <Switch
                className="scale-y-90"
                checked={toolbarEnabled}
                onCheckedChange={(checked) => updateSetting('toolbarEnabled', checked)}
              />
            </div>
            {toolbarEnabled && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t('settings.dwellLabel')}
                  <span className="ml-2 text-xs font-light">{t('settings.dwellHint')}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 bg-white"
                    disabled={toolbarDwellMs <= TOOLBAR_DWELL_MIN}
                    onClick={() =>
                      updateSetting(
                        'toolbarDwellMs',
                        normalizeToolbarDwellMs(toolbarDwellMs - TOOLBAR_DWELL_STEP)
                      )
                    }
                    title={t('settings.dwellDecrease')}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center text-sm font-medium">
                    {t('common.seconds', { n: toolbarDwellMs / 1000 })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 bg-white"
                    disabled={toolbarDwellMs >= TOOLBAR_DWELL_MAX}
                    onClick={() =>
                      updateSetting(
                        'toolbarDwellMs',
                        normalizeToolbarDwellMs(toolbarDwellMs + TOOLBAR_DWELL_STEP)
                      )
                    }
                    title={t('settings.dwellIncrease')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.opacityLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.opacityHint')}</span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <span className="text-xs whitespace-nowrap">
                  {t('settings.opacityTransparent')}
                </span>
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
            </div>
          </div>
        </div>

        {/* Shortcuts Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Keyboard className="h-5 w-5 mr-2" />
            {t('settings.shortcutsSection')}
            <div className="text-sm font-light ml-2 mt-1">{t('settings.shortcutsHint')}</div>
            <ResetDefaultShortcuts />
          </h2>
          <CustomShortcuts />
        </div>

        {/* Screenshot Save Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FolderOpen className="h-5 w-5 mr-2" />
            {t('settings.saveScreenshotsSection')}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.autoSaveLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.autoSaveHint')}</span>
              </label>
              <Switch
                className="scale-y-90"
                checked={screenshotAutoSave}
                onCheckedChange={(checked) => updateSetting('screenshotAutoSave', checked)}
              />
            </div>
            {screenshotAutoSave && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t('settings.saveDirLabel')}
                  <span className="ml-2 text-xs font-light">{t('settings.saveDirHint')}</span>
                </label>
                <button
                  className="text-xs text-gray-600 max-w-48 truncate hover:text-gray-900 cursor-pointer transition-colors"
                  title={t('settings.saveDirAction')}
                  onClick={async () => {
                    const dir = await window.api.selectScreenshotDir()
                    if (dir) updateSetting('screenshotDir', dir)
                  }}
                >
                  {screenshotDir || t('settings.saveDirDefault')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            {t('settings.privacySection')}
          </h2>

          <div className="space-y-4">
            <p className="text-sm">{t('settings.privacyNote')}</p>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t('settings.privacyModeLabel')}
                <span className="ml-2 text-xs font-light">{t('settings.privacyModeHint')}</span>
              </label>
              <Switch
                className="scale-y-90"
                checked={privacyMode}
                onCheckedChange={(checked) => updateSetting('privacyMode', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
