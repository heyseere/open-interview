import {
  startAudioCapture,
  stopAudioCapture,
  disableVAD,
  enableVAD,
  getLastCaptureMaxRms
} from '@/lib/audio-capture'
import { resolveTranscriptionOptions } from '@/lib/asr-config'
import { translate } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/settings'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'

let transitionLock = false

/** Stop capture and send the accumulated transcript to AI (manual or VAD). */
async function stopAndSend(): Promise<void> {
  const { language } = useSettingsStore.getState()
  const { setIsTranscribing } = useTranscriptionStore.getState()
  const { setErrorMessage } = useSolutionStore.getState()
  try {
    stopAudioCapture()
    const { text } = await window.api.stopTranscription()
    setIsTranscribing(false)

    if (text.trim()) {
      // Send FIRST, clear only after the main process accepted the text: a
      // failed send used to wipe the transcript before anyone could read it,
      // leaving nothing to retry.
      const result = await window.api.sendTextMessage(text)
      if (result.success) {
        await window.api.clearTranscriptionText()
      } else {
        setErrorMessage(result.error || translate(language, 'transcriptionError.sendFailed'))
      }
    }
  } catch (err) {
    console.error('Failed to stop transcription:', err)
    setErrorMessage(translate(language, 'transcriptionError.stopFailed'))
  }
}

/**
 * Stop the running transcription and submit the accumulated transcript to AI
 * right away ("停止并提交" toolbar action, also used by the toggle shortcut).
 */
export async function submitTranscriptionNow(): Promise<void> {
  if (transitionLock) return
  transitionLock = true
  try {
    await stopAndSend()
  } finally {
    transitionLock = false
  }
}

/**
 * Stop capture + the main-side engine without submitting. `clear` additionally
 * wipes the accumulated transcript from the bar.
 *
 * This is the ONE teardown path: the two former variants (cancel / quiet)
 * differed only by that flag and had drifted in error handling.
 */
async function teardown({ clear }: { clear: boolean }): Promise<void> {
  const { isTranscribing, setIsTranscribing, clearText } = useTranscriptionStore.getState()
  if (!isTranscribing) return
  disableVAD()
  stopAudioCapture()
  try {
    // Cancel paths discard: the in-flight recognition request is aborted
    // instead of awaited, so the stop is immediate.
    await window.api.stopTranscription({ discard: clear })
    if (clear) await window.api.clearTranscriptionText()
  } catch (err) {
    console.error('Failed to stop transcription:', err)
  }
  if (clear) clearText()
  setIsTranscribing(false)
}

/**
 * Stop the running transcription WITHOUT submitting ("停止识别并取消提交").
 * Discards the accumulated text and clears the status bar.
 */
export function cancelTranscription(): Promise<void> {
  return teardown({ clear: true })
}

/**
 * Stop an in-flight transcription WITHOUT submitting the text.
 * Used when switching to exam mode so capture never keeps running after its
 * shortcuts have been unregistered.
 */
function stopTranscriptionQuietly(): Promise<void> {
  return teardown({ clear: false })
}

/**
 * Record for a few seconds and return whatever the provider recognised,
 * WITHOUT sending it to the AI. Used by the settings page to verify a local
 * ASR setup end to end ("试录 3 秒").
 */
export async function sampleTranscription(seconds = 3): Promise<string> {
  const { language } = useSettingsStore.getState()
  if (useTranscriptionStore.getState().isTranscribing) {
    // Await the teardown: main only clears its runtime once the chunk queue
    // drains, and an immediate start would otherwise hit `alreadyRunning`
    await stopTranscriptionQuietly()
  }
  await toggleTranscription()
  if (!useTranscriptionStore.getState().isTranscribing) {
    throw new Error(translate(language, 'transcriptionError.startFailed'))
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    // Stop BEFORE reading the text: the streaming engine commits what is left
    // of the buffer during finalize, so reading first would miss the tail.
    await stopTranscriptionQuietly()
    const text = (await window.api.getTranscriptionText()).trim()
    if (!text && getLastCaptureMaxRms() < NO_AUDIO_RMS) {
      // Nothing recognisable AND the input device delivered essentially no
      // audio — point the user at the capture source, not the recognizer
      throw new Error(translate(language, 'settings.localVerifySilent'))
    }
    return text
  } finally {
    stopTranscriptionQuietly()
    await window.api.clearTranscriptionText().catch(() => undefined)
  }
}

/** Below this peak RMS a capture session is considered to have gotten no audio. */
const NO_AUDIO_RMS = 0.003

/**
 * Toggle real-time speech transcription. Shared by the global shortcut and
 * the hover toolbar; re-entered by the VAD auto-submit trigger. Guarded
 * against concurrent transitions.
 */
export async function toggleTranscription(): Promise<void> {
  if (transitionLock) return
  transitionLock = true
  try {
    const settings = useSettingsStore.getState()
    const { setErrorMessage } = useSolutionStore.getState()
    const { options } = resolveTranscriptionOptions(settings)

    const { isTranscribing, setIsTranscribing } = useTranscriptionStore.getState()

    if (isTranscribing) {
      await stopAndSend()
      return
    }

    // Ask the OS for mic / screen-recording access on the app's own behalf
    // (macOS TCC prompts, see main/permissions.ts) so no terminal workaround
    // is ever needed. Only bail out when the permission the actual capture
    // path needs is denied; in that case jump straight to the matching System
    // Settings pane, because a denied TCC decision can never re-prompt by
    // itself.
    try {
      const permissions = await window.api.ensureMediaPermissions()
      // A specific microphone is selected → capture runs through the mic;
      // otherwise the default path is system-audio loopback on BOTH platforms
      // (macOS uses Chromium's native loopback via feature flags). Only an
      // explicit denial blocks: 'unknown' means the app could not own the
      // prompt (dev build) and 'not-determined' still lets the OS decide
      // during capture.
      const needsMicrophone = Boolean(settings.audioInputDeviceId)
      const denied: 'microphone' | 'screen' | null = needsMicrophone
        ? permissions.microphone === 'denied'
          ? 'microphone'
          : null
        : permissions.screen === 'denied'
          ? 'screen'
          : null
      if (denied) {
        void window.api.openPrivacySettings(denied).catch(() => undefined)
        setErrorMessage(
          translate(settings.language, 'transcriptionError.mediaPermissionDenied'),
          'open-permissions'
        )
        return
      }
    } catch {
      // Best effort: proceed and let the capture step surface a real error
    }

    try {
      await window.api.startTranscription(options)
      await startAudioCapture()
      // Auto-submit on sustained silence after speech (see vad.ts)
      if (settings.autoSubmitTranscription) {
        enableVAD(() => {
          void toggleTranscription()
        })
      }
      setIsTranscribing(true)
      setErrorMessage(null)
    } catch (err) {
      console.error('Failed to start transcription:', err)
      stopAudioCapture()
      await window.api.stopTranscription().catch(() => undefined)
      setErrorMessage(translate(settings.language, 'transcriptionError.startFailed'))
    }
  } finally {
    transitionLock = false
  }
}
