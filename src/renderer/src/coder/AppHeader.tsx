import { useState } from 'react'
import {
  Captions,
  Chrome,
  History,
  SettingsIcon,
  HelpCircle,
  X,
  Shield,
  ShieldOff,
  Pointer,
  PointerOff,
  Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useSettingsStore, sceneDisplayName } from '@/lib/store/settings'
import { useExamChromeStore } from '@/lib/store/exam-chrome'
import { useAppStore } from '@/lib/store/app'
import { useI18n } from '@/lib/i18n'
import { GLASS_BORDER, GLASS_MODAL } from '@/lib/glass'
import { useDwellMs } from '@/lib/use-dwell-ms'
import { usePassthroughLift } from '@/lib/passthrough-lift'
import { DwellIconButton } from '@/components/DwellIconButton'
import { HistoryDialog } from './HistoryDialog'

export function AppHeader() {
  const navigate = useNavigate()
  const { t } = useI18n()
  // The INTENT, not the effective value: while the pointer hovers this header
  // the coordinator lifts passthrough (ignoreMouse false), and reading that
  // would show "off" and make the button re-arm instead of disabling.
  const passthrough = useAppStore((state) => state.passthrough)
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const scenes = useSettingsStore((state) => state.scenes)
  const activeSceneId = useSettingsStore((state) => state.activeSceneId)
  const setActiveScene = useSettingsStore((state) => state.setActiveScene)
  const dwell = useDwellMs()
  const examChromeRunning = useExamChromeStore((state) => state.running)
  const examChromePort = useExamChromeStore((state) => state.port)
  const isLaunchingExam = useExamChromeStore((state) => state.isLaunching)
  const launchExamChrome = useExamChromeStore((state) => state.launch)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sceneSelectOpen, setSceneSelectOpen] = useState(false)

  // Passthrough mode: the header joins the shared lift coordinator, so
  // hovering the icon area lifts the window and the icons become usable.
  // While the scene select or history dialog is open (both render in portals
  // outside this rect) the lift is held so they stay clickable too.
  const lift = usePassthroughLift({ hold: historyOpen || sceneSelectOpen })

  return (
    <div id="app-header" className="flex shrink-0 items-center justify-end text-white">
      <div ref={lift.ref} className="actions flex items-center flex-nowrap">
        {/* Active prompt scene: one visible switch point so the exam-time
            scene change (做题 ↔ 英语…) does not require a trip into settings.
            Alt+S cycles the same list. Stays click-only on purpose: a dropdown
            that opens on hover is more surprise than shortcut. */}
        {scenes.length > 1 && (
          <Select
            value={activeSceneId}
            onValueChange={setActiveScene}
            onOpenChange={setSceneSelectOpen}
          >
            <SelectTrigger
              title={t('header.sceneSwitcher')}
              className="mr-1 h-7 min-w-24 max-w-44 gap-1.5 rounded-full border-hairline bg-hairline pl-3 pr-2 text-xs font-medium text-white shadow-none backdrop-blur-sm transition-colors hover:bg-hairline-2 hover:text-live-soft data-[state=open]:bg-hairline-2 data-[state=open]:text-live-soft [&>svg]:size-3 [&>svg]:text-ink-faint"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={`${GLASS_MODAL} ${GLASS_BORDER} text-white`}>
              {scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id} className="rounded-md">
                  {sceneDisplayName(scene, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Exam Chrome (browser mode): gray = start it, blue = running,
            pale gray while launching. State lives in the exam-chrome store,
            pushed from main. */}
        <DwellIconButton
          durationMs={dwell()}
          title={
            isLaunchingExam
              ? t('header.examChromeLaunching')
              : examChromeRunning
                ? t('header.examChromeRunning', { port: examChromePort ?? 0 })
                : t('header.examChromeStopped')
          }
          disabled={isLaunchingExam}
          active={examChromeRunning}
          icon={isLaunchingExam ? Loader2 : Chrome}
          iconClassName={isLaunchingExam ? 'animate-spin' : undefined}
          onTrigger={() => void launchExamChrome()}
        />
        {/* Privacy mode: capture protection + hidden dock + no screenshot
            persistence. Flips in the settings store; the main process applies
            it when the setting syncs (applyPrivacyMode). Sits right next to
            the passthrough toggle — the two stealth controls read as a pair. */}
        <DwellIconButton
          durationMs={dwell()}
          title={privacyMode ? t('header.privacyOn') : t('header.privacyOff')}
          pressed={privacyMode}
          active={privacyMode}
          icon={privacyMode ? Shield : ShieldOff}
          onTrigger={() => updateSetting('privacyMode', !privacyMode)}
        />
        {/* Mouse passthrough: flips the INTENT in the main process and echoes
            back through sync-app-state. While passthrough is on the whole
            window is click-through; hovering this icon area lifts it so the
            icons stay reachable. The toggle sends no value — the value it
            would send is the lifted one, which is exactly how it used to
            re-arm itself instead of turning off. */}
        <DwellIconButton
          durationMs={dwell()}
          title={passthrough ? t('header.passThroughOn') : t('header.passThroughOff')}
          pressed={passthrough}
          active={passthrough}
          icon={passthrough ? PointerOff : Pointer}
          onTrigger={() => void window.api.togglePassthrough()}
        />
        <DwellIconButton
          durationMs={dwell()}
          title={t('header.toggleCompact')}
          pressed={uiLayout === 'compact'}
          active={uiLayout === 'compact'}
          icon={Captions}
          onTrigger={() =>
            updateSetting('uiLayout', uiLayout === 'compact' ? 'standard' : 'compact')
          }
        />
        <DwellIconButton
          durationMs={dwell()}
          title={t('history.title')}
          icon={History}
          onTrigger={() => setHistoryOpen(true)}
        />
        <DwellIconButton
          durationMs={dwell()}
          title={t('header.settings')}
          icon={SettingsIcon}
          onTrigger={() => navigate('/settings')}
        />
        <DwellIconButton
          durationMs={dwell()}
          title={t('help.title')}
          icon={HelpCircle}
          onTrigger={() => navigate('/help')}
        />
        <DwellIconButton
          durationMs={dwell()}
          title={t('header.close')}
          icon={X}
          onTrigger={() => window.close()}
        />
      </div>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  )
}
