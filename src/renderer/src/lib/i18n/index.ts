import { useCallback } from 'react'
import { useSettingsStore, type Language } from '@/lib/store/settings'
import { translateMessage } from '@shared/i18n'
import { messages, type TranslationKey, type TranslationParams } from '@shared/i18n/messages'

/** Resolve a message for the given language (zh-CN is the built-in default). */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  return translateMessage(messages, language, key, params)
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

export type { TranslationKey, TranslationParams }
