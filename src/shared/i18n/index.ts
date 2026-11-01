import type { TranslationParams } from './messages'

/** UI languages the app ships, in table order (renderer + main process). */
export const LANGUAGES = ['zh-CN', 'en'] as const

/** UI language shared by the renderer and the main process. */
export type Language = (typeof LANGUAGES)[number]

/** Resolve {placeholder} tokens in a message template. */
export function formatMessage(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

/**
 * Resolve one key from a message table for one language. Tables are `as const`
 * objects whose values carry both locales, so an unknown key is a compile
 * error at the call site (`keyof typeof table`).
 */
export function translateMessage<M extends Record<string, { zh: string; en: string }>>(
  messages: M,
  language: Language,
  key: keyof M & string,
  params?: TranslationParams
): string {
  return formatMessage(messages[key][language === 'en' ? 'en' : 'zh'], params)
}
