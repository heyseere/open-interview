import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Camera, ExternalLink, Info, Loader2, Mic, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/locales/zh-CN'

type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
type PermissionName = 'microphone' | 'screen'

const STATUS_KEYS: Record<PermissionStatus, TranslationKey> = {
  granted: 'permission.statusGranted',
  denied: 'permission.statusDenied',
  'not-determined': 'permission.statusNotDetermined',
  restricted: 'permission.statusRestricted',
  unknown: 'permission.statusUnknown'
}

const STATUS_STYLES: Record<PermissionStatus, string> = {
  granted: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
  restricted: 'bg-red-100 text-red-700',
  'not-determined': 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-200 text-gray-600'
}

function PermissionCard({
  icon: Icon,
  title,
  description,
  status,
  statusLabel,
  requestLabel,
  openSettingsLabel,
  requesting,
  isMac,
  onRequest,
  onOpenSettings
}: {
  icon: typeof Mic
  title: string
  description: string
  status: PermissionStatus | null
  statusLabel: string
  requestLabel: string
  openSettingsLabel: string
  requesting: boolean
  isMac: boolean
  onRequest: () => void
  onOpenSettings: () => void
}) {
  return (
    <div className="bg-gray-300/80 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className="h-5 w-5 mt-0.5 text-gray-700 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        {status ? (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[status]}`}
          >
            {statusLabel}
          </span>
        ) : (
          <Loader2 className="h-4 w-4 text-gray-400 animate-spin flex-shrink-0 mt-1" />
        )}
      </div>

      {isMac && (
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            disabled={requesting}
            onClick={onRequest}
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {requestLabel}
          </Button>
          <Button variant="outline" size="sm" className="bg-white" onClick={onOpenSettings}>
            <ExternalLink className="h-4 w-4" />
            {openSettingsLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * System permission center (macOS TCC): shows the live microphone /
 * screen-recording status, requests a still-undetermined permission and
 * deep-links into the matching System Settings pane when it was denied.
 */
export default function PermissionsPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<Record<PermissionName, PermissionStatus> | null>(null)
  const [requesting, setRequesting] = useState<PermissionName | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [isDev, setIsDev] = useState(false)

  const refresh = useCallback(() => {
    void window.api.getMediaPermissionStatus().then((next) => {
      setStatus({
        microphone: next.microphone as PermissionStatus,
        screen: next.screen as PermissionStatus
      })
    })
  }, [])

  useEffect(() => {
    refresh()
    void window.api.getAppInfo().then((info) => {
      setIsMac(info.platform === 'darwin')
      setIsDev(!info.isPackaged && info.platform === 'darwin')
    })
  }, [refresh])

  const request = async (name: PermissionName) => {
    setRequesting(name)
    try {
      await window.api.ensureMediaPermissions()
    } finally {
      setRequesting(null)
      refresh()
    }
  }

  return (
    <>
      {/* Header */}
      <div id="app-header" className="flex items-center">
        <div className="actions">
          <Button variant="ghost" asChild size="icon" className="w-12 mr-2 rounded-none">
            <Link to="/settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
        <h1>{t('permission.title')}</h1>
      </div>

      {/* Permission cards */}
      <div id="app-content" className="flex flex-col gap-4 p-8">
        <PermissionCard
          icon={Camera}
          title={t('permission.screenTitle')}
          description={t('permission.screenDesc')}
          status={status?.screen ?? null}
          statusLabel={status ? t(STATUS_KEYS[status.screen]) : ''}
          requestLabel={t('permission.requestAction')}
          openSettingsLabel={t('permission.openSettings')}
          requesting={requesting === 'screen'}
          isMac={isMac}
          onRequest={() => void request('screen')}
          onOpenSettings={() => void window.api.openPrivacySettings('screen')}
        />
        <PermissionCard
          icon={Mic}
          title={t('permission.micTitle')}
          description={t('permission.micDesc')}
          status={status?.microphone ?? null}
          statusLabel={status ? t(STATUS_KEYS[status.microphone]) : ''}
          requestLabel={t('permission.requestAction')}
          openSettingsLabel={t('permission.openSettings')}
          requesting={requesting === 'microphone'}
          isMac={isMac}
          onRequest={() => void request('microphone')}
          onOpenSettings={() => void window.api.openPrivacySettings('microphone')}
        />

        <div className="bg-gray-300/80 rounded-lg p-6 flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 text-gray-500 flex-shrink-0" />
          <div className="text-sm text-gray-600 space-y-2">
            {isDev ? <p>{t('permission.devNote')}</p> : null}
            {!isMac ? <p>{t('permission.grantedNote')}</p> : null}
            <p>{t('permission.deniedNote')}</p>
          </div>
        </div>
      </div>
    </>
  )
}
