import { startAudioCapture, stopAudioCapture, disableVAD, enableVAD } from '@/lib/audio-capture'
import { resolveTranscriptionOptions } from '@/lib/asr-config'
import { translate } from '@/lib/i18n'
import { useSettingsStore } from '@/lib/store/settings'
import { useSolutionStore } from '@/lib/store/solution'
import { useTranscriptionStore } from '@/lib/store/transcription'
import { isMac } from '@/lib/utils/env'

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
      await window.api.clearTranscriptionText()
      const result = await window.api.sendTextMessage(text)
      if (!result.success) {
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
 * Stop the running transcription WITHOUT submitting ("停止识别并取消提交").
 * Discards the accumulated text and clears the transcription bar.
 */
export async function cancelTranscription(): Promise<void> {
  const { isTranscribing, setIsTranscribing, clearText } = useTranscriptionStore.getState()
  if (!isTranscribing) return
  disableVAD()
  stopAudioCapture()
  try {
    await window.api.stopTranscription()
    await window.api.clearTranscriptionText()
  } catch (err) {
    console.error('Failed to cancel transcription:', err)
  }
  clearText()
  setIsTranscribing(false)
}

/**
 * Stop an in-flight transcription WITHOUT submitting the text.
 * Used when switching to exam mode so capture never keeps running after its
 * shortcuts have been unregistered.
 */
export async function stopTranscriptionQuietly(): Promise<void> {
  const { isTranscribing, setIsTranscribing } = useTranscriptionStore.getState()
  if (!isTranscribing) return
  disableVAD()
  stopAudioCapture()
  try {
    await window.api.stopTranscription()
  } catch (err) {
    console.error('Failed to stop transcription:', err)
  }
  setIsTranscribing(false)
}

/**
 * Record for a few seconds and return whatever the provider recognised,
 * WITHOUT sending it to the AI. Used by the settings page to verify a local
 * ASR setup end to end ("试录 3 秒").
 */
export async function sampleTranscription(seconds = 3): Promise<string> {
  if (useTranscriptionStore.getState().isTranscribing) {
    // Await the teardown: main only clears its runtime once the chunk queue
    // drains, and an immediate start would otherwise hit `alreadyRunning`
    await stopTranscriptionQuietly()
  }
  await toggleTranscription()
  if (!useTranscriptionStore.getState().isTranscribing) {
    const { language } = useSettingsStore.getState()
    throw new Error(translate(language, 'transcriptionError.startFailed'))
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    const text = await window.api.getTranscriptionText()
    return text.trim()
  } finally {
    stopTranscriptionQuietly()
    await window.api.clearTranscriptionText().catch(() => undefined)
  }
}

/**
 * Toggle real-time speech transcription. Shared by the global shortcut, the
 * header mic button (interview mode) and the hover toolbar; re-entered by the
 * VAD auto-submit trigger. Guarded against concurrent transitions.
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
      // macOS always captures through a microphone (no system-audio loopback
      // there); on Windows the default path is system-audio loopback unless a
      // specific microphone is selected. Only an explicit denial blocks:
      // 'unknown' means the app could not own the prompt (dev build) and
      // 'not-determined' still lets the OS decide during capture.
      const needsMicrophone = isMac || Boolean(settings.audioInputDeviceId)
      const denied: 'microphone' | 'screen' | null = needsMicrophone
        ? permissions.microphone === 'denied'
          ? 'microphone'
          : null
        : permissions.screen === 'denied'
          ? 'screen'
          : null
      if (denied) {
        void window.api.openPrivacySettings(denied).catch(() => undefined)
        setErrorMessage(translate(settings.language, 'transcriptionError.mediaPermissionDenied'))
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
