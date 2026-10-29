import type { Settings } from '@/lib/store/settings'

/**
 * Builds the start payload for local whisper.cpp transcription.
 *
 * Recognition is always local and always streaming (one resident
 * `whisper-server`, sliding-window windows) — there is no provider choice and
 * no segment length to configure, so this is a pure projection of the two
 * settings that matter. Environment problems (missing engine/model) surface as
 * FATAL transcription errors from the main process at start time.
 */

export type TranscriptionStartOptions = Parameters<typeof window.api.startTranscription>[0]

export function resolveTranscriptionOptions(
  settings: Pick<Settings, 'localAsrModelSize' | 'localAsrLanguage'>
): { options: TranscriptionStartOptions } {
  return {
    options: {
      modelSize: settings.localAsrModelSize,
      language: settings.localAsrLanguage
    }
  }
}
