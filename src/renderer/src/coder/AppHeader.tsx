import { useState } from 'react'
import {
  Captions,
  History,
  SettingsIcon,
  HelpCircle,
  X,
  Shield,
  ShieldOff,
  Pointer,
  PointerOff
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store/app'
import { useSettingsStore } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import { HistoryDialog } from './HistoryDialog'

export function AppHeader() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { ignoreMouse } = useAppStore()
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const uiLayout = useSettingsStore((state) => state.uiLayout)
  const setUiLayout = useSettingsStore((state) => state.updateSetting)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div id="app-header" className="flex items-center text-white">
      <div className="mx-auto pl-12">{t('app.title')}</div>
      <div
        className={`actions flex items-center flex-nowrap ${ignoreMouse ? 'pointer-events-none' : ''}`}
      >
        {/* Privacy mode: capture protection + hidden dock + no screenshot
            persistence. Flips in the settings store; the main process applies
            it when the setting syncs (applyPrivacyMode). */}
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-70"
          title={privacyMode ? t('header.privacyOn') : t('header.privacyOff')}
          onClick={() => updateSetting('privacyMode', !privacyMode)}
        >
          {privacyMode ? (
            <Shield className="text-blue-400" />
          ) : (
            <ShieldOff className="text-gray-400" />
          )}
        </Button>
        {/* Mouse passthrough: flips in the main process (setIgnoreMouseEvents)
            and echoes back through sync-app-state. Note: while passthrough is
            on, the header itself is not clickable — Alt+M or the toolbar
            hover-lift is the way back. */}
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-70"
          title={ignoreMouse ? t('header.passThroughOn') : t('header.passThroughOff')}
          onClick={() => void window.api.updateAppState({ ignoreMouse: !ignoreMouse })}
        >
          {ignoreMouse ? (
            <PointerOff className="text-blue-400" />
          ) : (
            <Pointer className="text-gray-400" />
          )}
        </Button>
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-50"
          title={t('header.toggleCompact')}
          onClick={() => setUiLayout('uiLayout', uiLayout === 'compact' ? 'standard' : 'compact')}
        >
          <Captions className={uiLayout === 'compact' ? 'text-blue-400' : undefined} />
        </Button>
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-50"
          title={t('header.history')}
          onClick={() => setHistoryOpen(true)}
        >
          <History />
        </Button>
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-50"
          onClick={() => navigate('/settings')}
        >
          <SettingsIcon />
        </Button>
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-50"
          onClick={() => navigate('/help')}
        >
          <HelpCircle />
        </Button>
        <Button
          variant="ghost"
          className="size-8 cursor-pointer hover:opacity-50 hover:text-red-500"
          onClick={() => window.close()}
        >
          <X />
        </Button>
      </div>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  )
}
