import { useSettingsStore } from '@/lib/store/settings'
import { SilenceDetector, computeRms } from '@/lib/utils/vad'

let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let processor: ScriptProcessorNode | null = null
let workletNode: AudioWorkletNode | null = null
let workletUrl: string | null = null

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
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(input[0].slice(0))
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
  if (silenceDetector && onSilenceTrigger) {
    if (silenceDetector.process(computeRms(float32), performance.now())) {
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

async function openMicrophoneStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId } },
    video: false
  })
}

async function openSystemAudioStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true
  })
  stream.getVideoTracks().forEach((t) => t.stop())
  return stream
}

async function connectCaptureTap(
  context: AudioContext,
  source: MediaStreamAudioSourceNode
): Promise<void> {
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
    // Tap only: the worklet writes no output, so nothing is doubled
    source.connect(workletNode)
    // Preserve the legacy ScriptProcessor passthrough behaviour (audible
    // monitoring of the captured stream)
    source.connect(context.destination)
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
    downsampleAndSend(e.inputBuffer.getChannelData(0))
  }
  source.connect(processor)
  processor.connect(context.destination)
}

export async function startAudioCapture(): Promise<void> {
  const { audioInputDeviceId, audioOutputDeviceId } = useSettingsStore.getState()

  let stream: MediaStream
  if (audioInputDeviceId) {
    try {
      stream = await openMicrophoneStream(audioInputDeviceId)
    } catch (err) {
      console.warn('Failed to open selected microphone, falling back to system audio:', err)
      stream = await openSystemAudioStream()
    }
  } else {
    stream = await openSystemAudioStream()
  }

  mediaStream = stream

  audioContext = new AudioContext({ sampleRate: 16000 })

  if (audioOutputDeviceId && 'setSinkId' in audioContext) {
    try {
      await (audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(
        audioOutputDeviceId
      )
    } catch (err) {
      console.warn('Failed to set audio output device:', err)
    }
  }

  const source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
  await connectCaptureTap(audioContext, source)
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
