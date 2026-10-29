import { useCallback, useEffect, useState } from 'react'
import { Camera, ExternalLink, Info, Loader2, Mic, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/Chip'
import { PageShell } from '@/components/PageHeader'
import { SectionCard } from '@/components/SectionCard'
import { Well } from '@/components/Well'
import { BusyButton } from '@/settings/components'
import { useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'

type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
type PermissionName = 'microphone' | 'screen'

const STATUS_KEYS: Record<PermissionStatus, TranslationKey> = {
  granted: 'permission.statusGranted',
  denied: 'permission.statusDenied',
  'not-determined': 'permission.statusNotDetermined',
  restricted: 'permission.statusRestricted',
  unknown: 'permission.statusUnknown'
}

/** Map each TCC status to a StatusChip tone (translucent semantic pill). */
const STATUS_TONES: Record<PermissionStatus, 'ok' | 'bad' | 'warn' | 'neutral'> = {
  granted: 'ok',
  denied: 'bad',
  restricted: 'bad',
  'not-determined': 'warn',
  unknown: 'neutral'
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
    <SectionCard
      icon={Icon}
      title={title}
      actions={
        status ? (
          <StatusChip tone={STATUS_TONES[status]}>{statusLabel}</StatusChip>
        ) : (
          <Loader2 className="size-4 text-muted-foreground animate-spin" />
        )
      }
    >
      <p className="text-sm text-muted-foreground">{description}</p>

      {isMac && (
        <div className="flex items-center gap-2">
          <BusyButton
            busy={requesting}
            icon={ShieldCheck}
            disabled={requesting}
            onClick={onRequest}
          >
            {requestLabel}
          </BusyButton>
          <Button variant="outline" onClick={onOpenSettings}>
            <ExternalLink className="size-4" />
            {openSettingsLabel}
          </Button>
        </div>
      )}
    </SectionCard>
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
    // The whole point of this page is "go grant it in System Settings, come
    // back" — refresh on window focus so the status chips flip to granted
    // the moment the user returns, without a manual re-entry.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
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
    <PageShell title={t('permission.title')} backTo="/settings">
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

      <Well className="flex items-start gap-3">
        <Info className="size-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="text-sm text-muted-foreground space-y-2">
          {isDev ? <p>{t('permission.devNote')}</p> : null}
          {!isMac ? <p>{t('permission.grantedNote')}</p> : null}
          <p>{t('permission.deniedNote')}</p>
        </div>
      </Well>
    </PageShell>
  )
}
