import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import {
  activeProviderOf,
  createProvider,
  useSettingsStore,
  type ProviderConfig
} from '@/lib/store/settings'
import {
  PROVIDER_PRESETS,
  detectPreset,
  presetDisplayName,
  providerDisplayName
} from '@/lib/providers'
import { SettingsRow } from './components'
import { GLASS_WELL } from '@/lib/glass'
import { SelectModel } from './SelectModel'

/**
 * Provider switcher + manager row.
 *
 * Adding offers the preset list, each carrying its own base URL, provider
 * kind (which native thinking fields to send) and suggested models. Deleting
 * removes the provider together with its encrypted key.
 */
export function ProviderSwitcher() {
  const { t } = useI18n()
  const providers = useSettingsStore((state) => state.providers)
  const activeProviderId = useSettingsStore((state) => state.activeProviderId)
  const setActiveProvider = useSettingsStore((state) => state.setActiveProvider)
  const addProvider = useSettingsStore((state) => state.addProvider)
  const updateProvider = useSettingsStore((state) => state.updateProvider)
  const removeProvider = useSettingsStore((state) => state.removeProvider)
  const active = activeProviderOf({ providers, activeProviderId })
  const [addOpen, setAddOpen] = useState(false)

  const handleAdd = (presetId: string) => {
    addProvider(createProvider(presetId))
    setAddOpen(false)
  }

  /** Switching providers restores that provider's encrypted key. */
  const handleSelect = async (providerId: string) => {
    setActiveProvider(providerId)
    const provider = useSettingsStore.getState().providers.find((item) => item.id === providerId)
    if (!provider || provider.apiKey) return
    const savedKey = await window.api.getProviderApiKey(providerId).catch(() => '')
    if (savedKey) updateProvider(providerId, { apiKey: savedKey })
  }

  const handleRemove = async (provider: ProviderConfig) => {
    // Drop the encrypted credential along with the provider
    await window.api.setProviderApiKey(provider.id, '')
    removeProvider(provider.id)
  }

  return (
    <SettingsRow label={t('settings.providerLabel')} hint={t('settings.providerHint')}>
      <div className="flex w-60 items-center gap-1.5">
        <Select value={active?.id ?? ''} onValueChange={(id) => void handleSelect(id)}>
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue placeholder={t('settings.providerPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {providerDisplayName(provider, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          title={t('settings.providerAdd')}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-bad"
          disabled={providers.length <= 1 || !active}
          title={t('settings.providerRemove')}
          onClick={() => active && void handleRemove(active)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.providerAdd')}</DialogTitle>
            <DialogDescription>{t('settings.providerAddDescription')}</DialogDescription>
          </DialogHeader>
          <div className="scroll-quiet grid max-h-80 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {PROVIDER_PRESETS.filter((preset) => preset.id !== 'custom').map((preset) => (
              <button
                key={preset.id}
                className={`flex flex-col items-start rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:border-live hover:bg-hairline ${GLASS_WELL}`}
                onClick={() => handleAdd(preset.id)}
              >
                <span className="text-sm font-medium">{presetDisplayName(preset, t)}</span>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {preset.baseURL || t('settings.providerCustomHint')}
                </span>
              </button>
            ))}
            <button
              className="flex flex-col items-start rounded-md border border-dashed border-hairline-2 px-3 py-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:border-live hover:bg-hairline"
              onClick={() => handleAdd('custom')}
            >
              <span className="text-sm font-medium">{t('settings.providerCustom')}</span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {t('settings.providerCustomHint')}
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsRow>
  )
}

/** Base URL / key / model rows for the active provider. */
export function ProviderFields() {
  const { t } = useI18n()
  const providers = useSettingsStore((state) => state.providers)
  const activeProviderId = useSettingsStore((state) => state.activeProviderId)
  const updateProvider = useSettingsStore((state) => state.updateProvider)
  const active = activeProviderOf({ providers, activeProviderId })
  const [showApiKey, setShowApiKey] = useState(false)

  if (!active) return null

  /** Editing the URL by hand re-detects the preset (and thus the kind). */
  const handleBaseURLChange = (value: string) => {
    const preset = detectPreset(value)
    updateProvider(active.id, {
      baseURL: value,
      ...(preset ? { presetId: preset.id, kind: preset.kind } : {})
    })
  }

  return (
    <>
      <SettingsRow label={t('settings.baseUrlLabel')} hint={t('settings.baseUrlHint')}>
        <Input
          value={active.baseURL}
          spellCheck={false}
          onChange={(event) => handleBaseURLChange(event.target.value)}
          placeholder={t('settings.baseUrlPlaceholder')}
          className="w-60"
        />
      </SettingsRow>

      <SettingsRow label={t('settings.apiKeyLabel')} hint={t('settings.apiKeyHint')}>
        {/* Keyed by provider so the visibility toggle resets on switch */}
        <div key={active.id} className="flex w-60 items-center">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={active.apiKey}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              // Store keeps the session copy per keystroke; the ENCRYPTED copy
              // is committed on blur / Enter (below) — writing it on every
              // keystroke meant a safeStorage encrypt + atomic file write for
              // each character typed.
              updateProvider(active.id, { apiKey: event.target.value })
            }}
            onBlur={(event) => void window.api.setProviderApiKey(active.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            placeholder={t('settings.apiKeyPlaceholder')}
            className="flex-1 rounded-r-none"
          />
          <Button
            variant="outline"
            className="rounded-l-none border-l-0 px-2"
            onClick={() => setShowApiKey((value) => !value)}
            title={showApiKey ? t('settings.apiKeyHide') : t('settings.apiKeyShow')}
          >
            {showApiKey ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
        </div>
      </SettingsRow>

      <SettingsRow label={t('settings.modelLabel')} hint={t('settings.modelHint')}>
        <SelectModel key={active.id} provider={active} />
      </SettingsRow>
    </>
  )
}
