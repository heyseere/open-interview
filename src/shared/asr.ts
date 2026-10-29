/**
 * Local ASR vocabulary shared by the main and renderer processes.
 *
 * These used to be duplicated (`src/main/whisper-cpp.ts` and
 * `store/settings.ts` each carried their own copy), which meant adding a model
 * size silently required two edits and could drift. One list, imported by
 * both sides.
 */

export const LOCAL_ASR_SIZES = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3',
  'large-v3-turbo'
] as const
export type LocalAsrModelSize = (typeof LOCAL_ASR_SIZES)[number]

export const LOCAL_ASR_LANGUAGES = ['auto', 'zh', 'en'] as const
export type LocalAsrLanguage = (typeof LOCAL_ASR_LANGUAGES)[number]

/** Audio format of every PCM buffer crossing the renderer → main boundary. */
const PCM_SAMPLE_RATE = 16_000
const PCM_BYTES_PER_SAMPLE = 2
export const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE
