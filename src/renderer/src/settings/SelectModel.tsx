import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, Check, Plus, X, RefreshCw } from 'lucide-react'
import { useSettingsStore, type ProviderConfig } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import { BusyButton } from './components'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

/**
 * Model picker for ONE provider: the searchable list merges the provider's
 * saved models (preset suggestions + previously fetched) with a fresh
 * `/models` result. The fetched list is fetched lazily (dropdown open, or
 * after the provider's base URL/key settles) and cached per provider.
 */
export function SelectModel({ provider }: { provider: ProviderConfig }) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const updateProvider = useSettingsStore((state) => state.updateProvider)
  const { t } = useI18n()
  const didAutoFetchRef = useRef<string | null>(null)

  const fetchBaseURL = provider.baseURL.trim()
  const fetchApiKey = provider.apiKey
  // Local OpenAI-compatible servers (Ollama, LM Studio) list models without a
  // key, so only the endpoint is required.
  const canFetchModels = Boolean(fetchBaseURL)
  // The cached list is stale when the provider's base URL differs from the one
  // its model list was fetched from.
  const modelsStale = Boolean(fetchBaseURL) && provider.modelsBaseURL !== fetchBaseURL

  const models = useMemo(
    () => provider.models.map((m) => ({ value: m, label: m })),
    [provider.models]
  )

  const fetchModels = useCallback(
    async (auto = false): Promise<boolean> => {
      if (!canFetchModels) {
        if (!auto) toast.error(t('model.needConfig'))
        return false
      }
      setIsFetchingModels(true)
      try {
        const fetched = await window.api.listOpenAIModels({
          baseURL: fetchBaseURL,
          apiKey: fetchApiKey
        })
        const ids = fetched.map((m) => m.id)
        // Read fresh state (not hook closures) so rapid config edits cannot
        // race: another provider may now be edited/removed.
        const current = useSettingsStore
          .getState()
          .providers.find((candidate) => candidate.id === provider.id)
        if (!current) return false
        const stale = current.modelsBaseURL !== fetchBaseURL
        // The endpoint changed: REPLACE the list so models from the previous
        // API do not linger (provider preset suggestions stay on top).
        updateProvider(provider.id, {
          models: stale ? ids : Array.from(new Set([...current.models, ...ids])),
          modelsBaseURL: fetchBaseURL,
          reasoningModelIds: fetched.filter((m) => m.reasoning).map((m) => m.id)
        })
        if (stale) {
          if (current.model && !ids.includes(current.model)) {
            updateProvider(provider.id, { model: '' })
            toast.info(t('toast.apiSwitched'))
          } else if (auto) {
            toast.info(t('toast.modelsRefreshed', { n: fetched.length }))
          }
        }
        if (!auto) toast.success(t('model.fetched', { n: fetched.length }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : t('model.fetchFailed')
        if (auto) {
          console.error('Auto fetch models failed:', message)
        } else {
          toast.error(message)
        }
        return false
      } finally {
        setIsFetchingModels(false)
      }
    },
    [canFetchModels, t, fetchBaseURL, fetchApiKey, updateProvider, provider.id]
  )

  // Auto-fetch the model list when the dropdown opens: on first use, or when
  // the base URL has changed since the cached list was fetched.
  useEffect(() => {
    if (!open) return
    const needsFetch = (provider.models.length === 0 || modelsStale) && canFetchModels
    if (needsFetch && didAutoFetchRef.current !== fetchBaseURL) {
      didAutoFetchRef.current = fetchBaseURL
      void fetchModels(true)
    }
  }, [open, provider.models.length, modelsStale, fetchBaseURL, canFetchModels, fetchModels])

  // Auto-refresh while typing: once a base URL + key pair settles (debounced),
  // silently fetch so the list follows the config without opening the dropdown.
  // The first run only records the fingerprint — no fetch on mount.
  const configFingerprintRef = useRef<string | null>(null)
  useEffect(() => {
    const fingerprint = `${provider.id}::${fetchBaseURL}::${fetchApiKey}`
    if (configFingerprintRef.current === null) {
      configFingerprintRef.current = fingerprint
      return
    }
    if (!canFetchModels || configFingerprintRef.current === fingerprint) return
    const timer = setTimeout(() => {
      configFingerprintRef.current = fingerprint
      void fetchModels(true)
    }, 1200)
    return () => clearTimeout(timer)
  }, [provider.id, fetchBaseURL, fetchApiKey, canFetchModels, fetchModels])

  const selectModel = (newValue: string) => {
    updateProvider(provider.id, { model: newValue })
    setSearchValue('')
    setOpen(false)
  }

  const addCustomModel = (newModel: string) => {
    const newValue = newModel.trim()
    if (!newValue) return
    if (!provider.models.includes(newValue)) {
      updateProvider(provider.id, { models: [...provider.models, newValue] })
    }
    selectModel(newValue)
  }

  const deleteCustomModel = (val: string) => {
    updateProvider(provider.id, { models: provider.models.filter((m) => m !== val) })
    if (provider.model === val) updateProvider(provider.id, { model: '' })
  }

  const filtered = models.filter((m) => m.label.toLowerCase().includes(searchValue.toLowerCase()))
  const showCreate =
    searchValue && !filtered.some((m) => m.label.toLowerCase() === searchValue.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-60 justify-between"
        >
          {provider.model
            ? (models.find((m) => m.value === provider.model)?.label ?? provider.model)
            : t('model.selectPlaceholder')}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput
            placeholder={t('model.searchOrCreate')}
            className="h-9"
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{t('model.noResults')}</CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <div key={m.value} className="group flex">
                  <CommandItem
                    value={m.value}
                    onSelect={(current) => {
                      selectModel(current === provider.model ? '' : current)
                    }}
                    className="flex-1"
                  >
                    <span className="truncate">{m.label}</span>
                    <Check
                      className={cn(
                        'ml-auto',
                        provider.model === m.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                  <div className="hidden group-hover:flex">
                    <button
                      className="text-muted-foreground hover:text-bad cursor-pointer"
                      onClick={() => deleteCustomModel(m.value)}
                    >
                      <X className="size-6" />
                    </button>
                  </div>
                </div>
              ))}
              {showCreate && (
                <CommandItem
                  value={`create-${searchValue}`}
                  onSelect={() => addCustomModel(searchValue)}
                  className="!text-live-soft"
                >
                  <Plus className="mr-2 size-4" />
                  {t('model.create', { name: searchValue })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-1 border-t p-1.5">
          <span className="min-w-0 truncate px-2 text-xs text-muted-foreground">
            {t('model.count', { n: models.length })}
            {modelsStale ? ` · ${t('model.staleHint')}` : ''}
          </span>
          <BusyButton
            busy={isFetchingModels}
            icon={RefreshCw}
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={isFetchingModels || !canFetchModels}
            title={canFetchModels ? t('model.fetchTitleReady') : t('model.fetchTitleBlocked')}
            onClick={() => void fetchModels()}
          >
            {t('model.fetchAction')}
          </BusyButton>
        </div>
      </PopoverContent>
    </Popover>
  )
}
