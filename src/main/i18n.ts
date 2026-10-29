import { translateMessage, type Language } from '@shared/i18n'
import { mainMessages, type MainMessageKey } from '@shared/i18n/messages'

/**
 * Main-process user-facing strings.
 *
 * The message tables live in src/shared/i18n so main and renderer share one
 * format implementation and one place to add strings. This module only owns
 * the main process's CURRENT language — pushed in by settings.ts
 * (setMainLanguage) to keep the rest of main dependency-free.
 */

let language: Language = 'zh-CN'

export function setMainLanguage(next: Language): void {
  language = next === 'en' ? 'en' : 'zh-CN'
}

/** Resolve a main-process string for the synced UI language (falls back to zh-CN). */
export function tMain(key: MainMessageKey, params?: Record<string, string | number>): string {
  return translateMessage(mainMessages, language, key, params)
}
