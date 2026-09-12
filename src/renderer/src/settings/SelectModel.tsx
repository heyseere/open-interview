import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, Check, Plus, X, Loader2, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/settings'
import { useI18n } from '@/lib/i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

export function SelectModel({
  value,
  onChange,
  disabled,
  className
}: {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const { customModels, updateSetting, apiBaseURL, apiKey, modelsBaseURL } = useSettingsStore()
  const { t } = useI18n()
  const didAutoFetchRef = useRef<string | null>(null)

  const fetchBaseURL = apiBaseURL.trim()
  const fetchApiKey = apiKey
  const canFetchModels = Boolean(fetchBaseURL) && Boolean(fetchApiKey.trim())
  // The cached list is stale when the configured API Base URL differs from
  // the one the model list was fetched from.
  const modelsStale = Boolean(fetchBaseURL) && modelsBaseURL !== fetchBaseURL

  const models = useMemo(() => customModels.map((m) => ({ value: m, label: m })), [customModels])

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
        // Merge fetched models with already-known ones, deduplicated
        updateSetting('customModels', Array.from(new Set([...customModels, ...fetched])))
        updateSetting('modelsBaseURL', fetchBaseURL)
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
    [canFetchModels, t, fetchBaseURL, fetchApiKey, customModels, updateSetting]
  )

  // Auto-fetch the model list when the dropdown opens: on first use, or when
  // the API Base URL has changed since the cached list was fetched.
  useEffect(() => {
    if (!open) return
    const needsFetch = (customModels.length === 0 || modelsStale) && canFetchModels
    if (needsFetch && didAutoFetchRef.current !== fetchBaseURL) {
      didAutoFetchRef.current = fetchBaseURL
      void fetchModels(true)
    }
  }, [open, customModels.length, modelsStale, fetchBaseURL, canFetchModels, fetchModels])

  const addCustomModel = (newModel: string) => {
    const newValue = newModel.trim()
    if (!newValue) return
    const exists = models.some((m) => m.value === newValue)
    if (exists) {
      onChange?.(newValue)
      setOpen(false)
      setSearchValue('')
      return
    }
    updateSetting('customModels', [...customModels, newValue])
    onChange?.(newValue)
    setSearchValue('')
    setOpen(false)
  }

  const deleteCustomModel = (val: string) => {
    updateSetting(
      'customModels',
      customModels.filter((m) => m !== val)
    )
    if (value === val) {
      onChange?.('')
    }
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
          disabled={disabled}
          className={cn('w-60 justify-between', className)}
        >
          {value
            ? (models.find((m) => m.value === value)?.label ?? value)
            : t('model.selectPlaceholder')}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0">
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
                      onChange?.(current === value ? '' : current)
                      setSearchValue('')
                      setOpen(false)
                    }}
                    className="flex-1"
                  >
                    {m.label}
                    <Check
                      className={cn('ml-auto', value === m.value ? 'opacity-100' : 'opacity-0')}
                    />
                  </CommandItem>
                  <div className="hidden group-hover:flex">
                    <button
                      className="text-gray-400 hover:text-red-500 cursor-pointer"
                      onClick={() => deleteCustomModel(m.value)}
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              ))}
              {showCreate && (
                <CommandItem
                  value={`create-${searchValue}`}
                  onSelect={() => addCustomModel(searchValue)}
                  className="!text-blue-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('model.create', { name: searchValue })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t p-1.5">
          <span className="px-2 text-xs text-gray-500">
            {t('model.count', { n: models.length })}
            {modelsStale ? ` · ${t('model.staleHint')}` : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isFetchingModels || !canFetchModels}
            title={canFetchModels ? t('model.fetchTitleReady') : t('model.fetchTitleBlocked')}
            onClick={() => void fetchModels()}
          >
            {isFetchingModels ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            {t('model.fetchAction')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
