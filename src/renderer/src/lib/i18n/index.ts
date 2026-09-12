import { useCallback } from 'react'
import { useSettingsStore, type Language } from '@/lib/store/settings'
import { zhCN, type TranslationKey, type TranslationParams } from './locales/zh-CN'
import { en } from './locales/en'

const dictionaries: Record<Language, Partial<Record<TranslationKey, string>>> = {
  'zh-CN': zhCN,
  en
}

function format(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

/** Resolve a key for the given language, falling back to zh-CN. */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const template = dictionaries[language][key] ?? zhCN[key]
  return format(template, params)
}

/**
 * Access translations bound to the current UI language setting.
 * Usage: `const { t } = useI18n()` then `t('common.cancel')`.
 */
export function useI18n(): { t: (key: TranslationKey, params?: TranslationParams) => string } {
  const language = useSettingsStore((state) => state.language)
  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
    [language]
  )
  return { t }
}
