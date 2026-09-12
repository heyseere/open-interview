import type { Settings } from '@/lib/store/settings'

/**
 * Builds the start payload for local whisper.cpp transcription. There is no
 * provider selection anymore: transcription is always local, so this always
 * succeeds and environment problems (missing engine/model) surface as
 * transcription errors at start time in the main process.
 */

export type TranscriptionStartOptions = Parameters<typeof window.api.startTranscription>[0]

export function resolveTranscriptionOptions(
  settings: Pick<Settings, 'localAsrModelSize' | 'localAsrLanguage' | 'chunkSeconds'>
): { ok: true; options: TranscriptionStartOptions } {
  return {
    ok: true,
    options: {
      modelSize: settings.localAsrModelSize,
      language: settings.localAsrLanguage,
      chunkSeconds: settings.chunkSeconds
    }
  }
}
