import { ipcMain } from 'electron'
import { tMain } from './i18n'
import {
  cancelLocalAsrSetup,
  localAsrStatus,
  setupLocalAsr,
  transcribeWindow,
  LOCAL_ASR_LANGUAGES,
  LOCAL_ASR_SIZES,
  type LocalAsrLanguage,
  type LocalAsrModelSize
} from './whisper-server'
import { createStreamingAsr, STEP_MS, type StreamingAsr } from './streaming-asr'
import { emitToRenderer, toErrorMessage } from './renderer-send'
import type { SolutionErrorAction } from '../shared/solution-error'

export interface TranscriptionStartOptions {
  /** Model size for the local whisper.cpp engine */
  modelSize?: LocalAsrModelSize
  /** Recognition language (`auto` detects it) */
  language?: LocalAsrLanguage
}

export interface TranscriptionStopResult {
  text: string
}

export interface TranscriptionStopOptions {
  /**
   * Drop everything not yet transcribed. Cancelling must return immediately:
   * the in-flight `/inference` request is aborted rather than awaited.
   */
  discard?: boolean
}

export interface TranscriptionError {
  message: string
  fatal: boolean
  /** Repair affordance for the renderer error row (e.g. open setup). */
  action?: SolutionErrorAction
}

/** Fatal setup failure whose repair path is known (engine/model → setup). */
class TranscriptionSetupError extends Error {
  readonly action: SolutionErrorAction
  constructor(message: string, action: SolutionErrorAction) {
    super(message)
    this.action = action
  }
}

interface StreamingRuntime {
  label: string
  modelSize: LocalAsrModelSize
  language: LocalAsrLanguage
  asr: StreamingAsr
  timer: NodeJS.Timeout | null
}

let runtime: StreamingRuntime | null = null
let accumulatedText = ''

function sendTranscriptionText() {
  emitToRenderer('transcription-text', { text: getTranscriptionText() })
}

function reportError(message: string, fatal: boolean, action?: SolutionErrorAction) {
  emitToRenderer('transcription-error', { message, fatal, action } satisfies TranscriptionError)
}

function resetTranscriptionText() {
  accumulatedText = ''
}

function appendFinalText(text: string) {
  if (!text) return
  accumulatedText += text
  sendTranscriptionText()
}

function emitPartial(text: string) {
  emitToRenderer('transcription-partial', { text })
}

/** Stop the step timer; the runtime itself stays alive until stop/cancel. */
function clearTimer(current: StreamingRuntime): void {
  if (current.timer) {
    clearInterval(current.timer)
    current.timer = null
  }
}

function startStreaming(
  label: string,
  modelSize: LocalAsrModelSize,
  language: LocalAsrLanguage
): void {
  const asr = createStreamingAsr({
    transcribe: async (pcm, prompt) => transcribeWindow(modelSize, pcm, { language, prompt }),
    onCommit: (text) => appendFinalText(text),
    onPartial: (text) => emitPartial(text),
    onError: (message) => {
      console.error(`${label} transcription failed: ${message}`)
      reportError(message, false)
    }
  })

  const created: StreamingRuntime = { label, modelSize, language, asr, timer: null }
  // The tick is a no-op while a request is in flight, so a slow round trip
  // never queues up behind itself.
  created.timer = setInterval(() => {
    void asr.tick()
  }, STEP_MS)
  runtime = created
}

async function startTranscription(options: TranscriptionStartOptions): Promise<void> {
  if (runtime) {
    throw new Error(tMain('err.alreadyRunning'))
  }

  resetTranscriptionText()
  emitToRenderer('transcription-cleared')
  emitPartial('')

  const modelSize = (options.modelSize || 'base') as LocalAsrModelSize
  const languageInput = (options.language || 'auto') as string
  const language = (
    (LOCAL_ASR_LANGUAGES as readonly string[]).includes(languageInput) ? languageInput : 'auto'
  ) as LocalAsrLanguage

  const label = tMain('label.localModel')
  startStreaming(label, modelSize, language)

  // Surface a missing engine/model immediately as a FATAL error instead of
  // failing per chunk: with a streaming window there is no "later chunk" that
  // could succeed, and the renderer must stop capturing.
  try {
    const status = await localAsrStatus(modelSize)
    if (status.cli !== 'found') {
      throw new TranscriptionSetupError(tMain('err.noCli'), 'open-settings')
    }
    if (!status.modelCached) {
      throw new TranscriptionSetupError(tMain('err.noModel'), 'open-settings')
    }
  } catch (error) {
    await stopTranscription({ discard: true })
    const action = error instanceof TranscriptionSetupError ? error.action : undefined
    reportError(toErrorMessage(error, tMain('err.transcribeFailed')), true, action)
    throw error
  }
}

async function stopTranscription(
  options?: TranscriptionStopOptions
): Promise<TranscriptionStopResult> {
  const current = runtime
  if (!current) return { text: getTranscriptionText() }

  clearTimer(current)
  runtime = null

  if (options?.discard) {
    current.asr.cancel()
  } else {
    await current.asr.finalize()
  }
  emitPartial('')
  emitToRenderer('transcription-stopped')
  return { text: getTranscriptionText() }
}

function handleAudioChunk(chunk: ArrayBuffer) {
  if (!runtime) return
  runtime.asr.push(Buffer.from(chunk))
}

export function getTranscriptionText(): string {
  return accumulatedText
}

/** Clear both the committed transcript and any in-flight partial tail. */
export function clearTranscriptionText() {
  resetTranscriptionText()
  runtime?.asr.reset()
  emitPartial('')
}

ipcMain.handle('start-transcription', (_event, options: unknown) => {
  return startTranscription(
    options && typeof options === 'object' ? (options as TranscriptionStartOptions) : {}
  )
})

ipcMain.handle('setup-local-asr', (_event, modelSize: LocalAsrModelSize) => {
  const size = (LOCAL_ASR_SIZES as readonly string[]).includes(modelSize)
    ? (modelSize as LocalAsrModelSize)
    : 'base'
  return setupLocalAsr(size)
})

ipcMain.handle('local-asr-status', (_event, modelSize: LocalAsrModelSize) => {
  const size = (LOCAL_ASR_SIZES as readonly string[]).includes(modelSize)
    ? (modelSize as LocalAsrModelSize)
    : 'base'
  return localAsrStatus(size)
})

ipcMain.handle('cancel-local-asr-setup', () => {
  cancelLocalAsrSetup()
})

ipcMain.handle('stop-transcription', (_event, options?: TranscriptionStopOptions) => {
  return stopTranscription(options)
})

ipcMain.on('transcription-audio-chunk', (_event, chunk: unknown) => {
  // A malformed payload would throw inside Buffer.from and kill the send
  // listener's invocation; drop it instead.
  if (!(chunk instanceof ArrayBuffer)) return
  handleAudioChunk(chunk)
})

ipcMain.handle('get-transcription-text', () => {
  return getTranscriptionText()
})

ipcMain.handle('clear-transcription-text', () => {
  clearTranscriptionText()
  emitToRenderer('transcription-cleared')
})
