import type { TranslationKey } from './i18n'

/**
 * Bottom-toolbar button registry.
 *
 * Every button the floating toolbar can render is declared here once: its
 * stable id, label, icon name and the section it belongs to. The toolbar
 * renders only the ids the user enabled in Settings, and a narrow window
 * splits the resulting list into two rows automatically.
 */

export const TOOLBAR_BUTTON_IDS = [
  'voice',
  'autoSubmit',
  'submitTranscript',
  'clearTranscript',
  'takeScreenshot',
  'fullPageCapture',
  'appendScreenshot',
  'followUp',
  'stop',
  'retry',
  'newSession'
] as const

export type ToolbarButtonId = (typeof TOOLBAR_BUTTON_IDS)[number]

export type ToolbarSection = 'transcription' | 'screenshot' | 'generation'

export const TOOLBAR_SECTIONS: ToolbarSection[] = ['transcription', 'screenshot', 'generation']

interface ToolbarButtonMeta {
  labelKey: TranslationKey
  section: ToolbarSection
}

export const TOOLBAR_BUTTON_META: Record<ToolbarButtonId, ToolbarButtonMeta> = {
  voice: { labelKey: 'toolbar.voice', section: 'transcription' },
  autoSubmit: { labelKey: 'toolbar.autoSubmit', section: 'transcription' },
  submitTranscript: { labelKey: 'toolbar.submitTranscript', section: 'transcription' },
  clearTranscript: { labelKey: 'toolbar.clearTranscript', section: 'transcription' },
  takeScreenshot: { labelKey: 'toolbar.takeScreenshot', section: 'screenshot' },
  fullPageCapture: { labelKey: 'toolbar.fullPageCapture', section: 'screenshot' },
  appendScreenshot: { labelKey: 'toolbar.appendScreenshot', section: 'screenshot' },
  followUp: { labelKey: 'toolbar.followUp', section: 'screenshot' },
  stop: { labelKey: 'toolbar.stop', section: 'generation' },
  retry: { labelKey: 'toolbar.retry', section: 'generation' },
  newSession: { labelKey: 'toolbar.newSession', section: 'generation' }
}

export const TOOLBAR_BUTTON_DEFAULT: ToolbarButtonId[] = [...TOOLBAR_BUTTON_IDS]

export const TOOLBAR_SECTION_LABEL_KEYS: Record<ToolbarSection, TranslationKey> = {
  transcription: 'settings.toolbarSectionTranscription',
  screenshot: 'settings.toolbarSectionScreenshot',
  generation: 'settings.toolbarSectionGeneration'
}

/** Window width below which transcription splits onto its own row. */
export const TWO_ROW_WIDTH = 620
/** Window width below which every section gets its own row. */
export const THREE_ROW_WIDTH = 460

export interface ToolbarSectionEntry<T = unknown> {
  section: ToolbarSection
  buttons: T[]
}

/**
 * Row layout by window width, measured on the WINDOW not the pill (the pill
 * is centered and its content is what overflows, so a window-width threshold
 * keeps the decision stable — no layout feedback loop): one row when wide,
 * transcription split off below TWO_ROW_WIDTH (capture + generation share the
 * second row), and one row per section below THREE_ROW_WIDTH. Empty rows
 * never render.
 */
export function splitToolbarRows<T>(
  sections: ToolbarSectionEntry<T>[],
  width: number
): ToolbarSectionEntry<T>[][] {
  if (width >= TWO_ROW_WIDTH) return [sections]
  if (width >= THREE_ROW_WIDTH) {
    return [
      sections.filter((entry) => entry.section === 'transcription'),
      sections.filter((entry) => entry.section !== 'transcription')
    ].filter((row) => row.length > 0)
  }
  return sections.map((entry) => [entry]).filter((row) => row[0].buttons.length > 0)
}

/** Guard persisted values against ids removed/renamed in a later version. */
export function normalizeToolbarButtons(value: unknown): ToolbarButtonId[] {
  if (!Array.isArray(value)) return TOOLBAR_BUTTON_DEFAULT
  const valid = new Set<string>(TOOLBAR_BUTTON_IDS)
  const filtered = value.filter(
    (id): id is ToolbarButtonId => typeof id === 'string' && valid.has(id)
  )
  // An empty selection would leave an empty pill — treat it as "all"
  return filtered.length > 0 ? filtered : TOOLBAR_BUTTON_DEFAULT
}
