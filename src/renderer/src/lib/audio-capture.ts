import { useSettingsStore } from '@/lib/store/settings'
import { isMac } from '@/lib/utils/env'
import { SilenceDetector, computeRms } from '@/lib/utils/vad'

let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let processor: ScriptProcessorNode | null = null
let workletNode: AudioWorkletNode | null = null
let workletUrl: string | null = null

/** Peak input level of the most recent capture session (for silence diagnostics). */
let captureMaxRms = 0

/** Active silence detector for auto-submitting transcriptions (VAD). */
let silenceDetector: SilenceDetector | null = null
let onSilenceTrigger: (() => void) | null = null

/**
 * AudioWorklet that forwards raw input frames to the main thread. Runs on the
 * audio rendering thread, keeping the renderer's main thread free (unlike the
 * legacy ScriptProcessorNode fallback below).
 */
const PCM_CAPTURE_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input && input.length > 0 && input[0] && input[0].length > 0) {
      let frame
      if (input.length === 1) {
        frame = input[0].slice(0)
      } else {
        // Downmix stereo input to mono (loopback capture is stereo): only
        // the first channel was tapped before, losing right-channel speech
        frame = new Float32Array(input[0].length)
        for (let ch = 0; ch < input.length; ch++) {
          const data = input[ch]
          if (!data) continue
          for (let i = 0; i < frame.length; i++) frame[i] += data[i]
        }
        for (let i = 0; i < frame.length; i++) frame[i] /= input.length
      }
      this.port.postMessage(frame)
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor)
`

/**
 * Enable auto-submit: when sustained silence follows detected speech,
 * `callback` fires exactly once (see SilenceDetector).
 * Settings are captured at enable time and apply until disabled.
 */
export function enableVAD(callback: () => void): void {
  const { vadSilenceMs } = useSettingsStore.getState()
  silenceDetector = new SilenceDetector(vadSilenceMs)
  onSilenceTrigger = callback
}

export function disableVAD(): void {
  silenceDetector = null
  onSilenceTrigger = null
}

function downsampleAndSend(float32: Float32Array): void {
  const rms = computeRms(float32)
  if (rms > captureMaxRms) captureMaxRms = rms
  if (silenceDetector && onSilenceTrigger) {
    if (silenceDetector.process(rms, performance.now())) {
      const callback = onSilenceTrigger
      // Detach first so a burst of frames cannot fire twice
      disableVAD()
      callback()
      return
    }
  }

  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  window.api.sendTranscriptionAudioChunk(int16.buffer)
}

/**
 * Raw-capture constraints: all browser audio processing is disabled. This is
 * required for system-audio loopback capture (the default input on both
 * platforms): its input signal IS the system render mix, so Chromium's
 * default echo cancellation treats it as the far-end echo and cancels it away
 * — the result is near-silence and garbage transcripts. Noise suppression and
 * AGC likewise mangle music/system sounds. Plain microphones transcribe
 * better on faithful raw audio too.
 */
const RAW_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false
}

async function openMicrophoneStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId }, ...RAW_AUDIO_CONSTRAINTS },
    video: false
  })
}

async function openDefaultMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO_CONSTRAINTS, video: false })
}

/**
 * System-audio loopback via getDisplayMedia. With the Chromium feature flags
 * enabled in the main process (`MacLoopbackAudioForScreenShare` +
 * `MacSckSystemAudioLoopbackOverride`, see main/index.ts) this captures the
 * system output mix natively on macOS 13.2+ too — the loopback `audio:
 * 'loopback'` handler response is no longer Windows-only.
 */
async function openSystemAudioStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true
  })
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error('system-audio loopback returned no audio track')
  }
  // The video track only exists because getDisplayMedia requires requesting
  // it; stop and detach it so the capture graph is audio-only (per the
  // electron-audio-loopback reference implementation)
  stream.getVideoTracks().forEach((t) => {
    t.stop()
    stream.removeTrack(t)
  })
  return stream
}

async function connectCaptureTap(
  context: AudioContext,
  source: MediaStreamAudioSourceNode
): Promise<void> {
  // Keep the graph pulled from the destination through a zero-gain node:
  // capture must stay silent (monitoring the stream feeds echo back into the
  // microphone and doubles loopback audio), but a source connected only to a
  // dead-end tap risks the ScriptProcessor fallback never being pulled.
  const monitorGain = context.createGain()
  monitorGain.gain.value = 0
  source.connect(monitorGain)
  monitorGain.connect(context.destination)

  try {
    const blob = new Blob([PCM_CAPTURE_WORKLET_SOURCE], { type: 'application/javascript' })
    workletUrl = URL.createObjectURL(blob)
    await context.audioWorklet.addModule(workletUrl)
    workletNode = new AudioWorkletNode(context, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    })
    workletNode.port.onmessage = (event) => {
      downsampleAndSend(event.data as Float32Array)
    }
    // Tap only: the worklet writes no output
    source.connect(workletNode)
    return
  } catch (err) {
    console.warn('AudioWorklet unavailable, falling back to ScriptProcessorNode:', err)
    if (workletUrl) {
      URL.revokeObjectURL(workletUrl)
      workletUrl = null
    }
  }

  // Legacy fallback: runs on the renderer main thread
  processor = context.createScriptProcessor(2048, 1, 1)
  processor.onaudioprocess = (e) => {
    const buffer = e.inputBuffer
    let frame = buffer.getChannelData(0)
    if (buffer.numberOfChannels > 1) {
      // Same stereo downmix as the worklet path
      const mixed = new Float32Array(frame.length)
      for (let i = 0; i < frame.length; i++) mixed[i] = frame[i]
      for (let ch = 1; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch)
        for (let i = 0; i < mixed.length; i++) mixed[i] += data[i]
      }
      for (let i = 0; i < mixed.length; i++) mixed[i] /= buffer.numberOfChannels
      frame = mixed
    }
    downsampleAndSend(frame)
  }
  source.connect(processor)
  processor.connect(monitorGain)
}

export async function startAudioCapture(): Promise<void> {
  const { audioInputDeviceId } = useSettingsStore.getState()
  captureMaxRms = 0

  let stream: MediaStream
  if (audioInputDeviceId) {
    try {
      stream = await openMicrophoneStream(audioInputDeviceId)
    } catch (err) {
      console.warn('Failed to open selected microphone, falling back:', err)
      stream = isMac ? await openDefaultMicrophoneStream() : await openSystemAudioStream()
    }
  } else {
    // No device selected: capture system-audio loopback (the platform
    // default on both macOS and Windows)
    stream = await openSystemAudioStream()
  }

  mediaStream = stream

  audioContext = new AudioContext({ sampleRate: 16000 })
  console.info(
    '[asr] capture opened:',
    JSON.stringify({
      tracks: stream.getAudioTracks().map((t) => t.label),
      ctxRate: audioContext.sampleRate,
      ctxState: audioContext.state
    })
  )

  const source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
  await connectCaptureTap(audioContext, source)
}

/**
 * Peak RMS of the most recent capture session. Silence-guard helper: values
 * below ~0.003 mean the input device delivered essentially no audio at all
 * (wrong device selected, or a loopback session that came up before any
 * system audio was playing).
 */
export function getLastCaptureMaxRms(): number {
  return captureMaxRms
}

export function stopAudioCapture(): void {
  disableVAD()
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (workletNode) {
    workletNode.port.onmessage = null
    workletNode.disconnect()
    workletNode = null
  }
  if (workletUrl) {
    URL.revokeObjectURL(workletUrl)
    workletUrl = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}
