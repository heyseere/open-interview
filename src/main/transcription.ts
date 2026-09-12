import { ipcMain } from 'electron'
import { tMain } from './i18n'
import {
  cancelLocalAsrSetup,
  localAsrStatus,
  setupLocalAsr,
  transcribeWithWhisperCpp,
  LOCAL_ASR_LANGUAGES,
  LOCAL_ASR_SIZES,
  type LocalAsrLanguage,
  type LocalAsrModelSize
} from './whisper-cpp'

const PCM_BYTES_PER_SECOND = 16_000 * 2

export interface TranscriptionStartOptions {
  /** Model size for the local whisper.cpp provider */
  modelSize?: LocalAsrModelSize
  /** Recognition language for whisper-cli (`auto` detects it) */
  language?: LocalAsrLanguage
  chunkSeconds?: number
}

export interface TranscriptionStopResult {
  text: string
}

export interface TranscriptionError {
  message: string
  fatal: boolean
}

/** Where chunked transcription sends each audio segment. */
interface ChunkedEngine {
  kind: 'wcpp'
  modelSize: LocalAsrModelSize
  language: LocalAsrLanguage
}

interface ChunkedRuntime {
  engine: ChunkedEngine
  label: string // provider name used in error messages
  chunkBytes: number
  pending: Buffer
  queue: Buffer[]
  processing: boolean
  stopping: boolean
  idleResolvers: Array<() => void>
  lastError: string | null
  processedChunks: number
}

export interface TranscriptionProgress {
  processed: number
  queued: number
}

let chunkedRuntime: ChunkedRuntime | null = null
let accumulatedText = ''

function sendToRenderer(channel: string, ...args: unknown[]) {
  const mainWindow = global.mainWindow
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

function sendTranscriptionText() {
  sendToRenderer('transcription-text', { text: getTranscriptionText() })
}

function reportError(message: string, fatal: boolean) {
  sendToRenderer('transcription-error', { message, fatal } satisfies TranscriptionError)
}

function resetTranscriptionText() {
  accumulatedText = ''
}

function appendFinalText(text: string) {
  if (!text) return
  accumulatedText += text
  sendTranscriptionText()
}

/** Report chunked transcription progress so the renderer can show a status hint. */
function sendChunkProgress(runtime: ChunkedRuntime) {
  const queued = runtime.queue.length + (runtime.pending.length > 0 ? 1 : 0)
  sendToRenderer('transcription-progress', {
    processed: runtime.processedChunks,
    queued
  } satisfies TranscriptionProgress)
}

function enqueueChunk(runtime: ChunkedRuntime, pcm: Buffer) {
  if (pcm.length === 0) return
  runtime.queue.push(pcm)
  sendChunkProgress(runtime)
  void processChunkQueue(runtime)
}

function resolveChunkIdle(runtime: ChunkedRuntime) {
  if (runtime.processing || runtime.queue.length > 0) return
  const resolvers = runtime.idleResolvers.splice(0)
  resolvers.forEach((resolve) => resolve())
}

function waitForChunkIdle(runtime: ChunkedRuntime): Promise<void> {
  if (!runtime.processing && runtime.queue.length === 0) return Promise.resolve()
  return new Promise((resolve) => runtime.idleResolvers.push(resolve))
}

async function transcribeChunk(runtime: ChunkedRuntime, pcm: Buffer) {
  const text = await transcribeWithWhisperCpp(
    runtime.engine.modelSize,
    runtime.engine.language,
    pcm
  )
  if (text) appendFinalText(text)
}

async function processChunkQueue(runtime: ChunkedRuntime) {
  if (runtime.processing) return

  runtime.processing = true
  try {
    while (runtime.queue.length > 0) {
      const chunk = runtime.queue.shift()
      if (!chunk) continue

      try {
        await transcribeChunk(runtime, chunk)
        runtime.processedChunks++
        runtime.lastError = null
        sendChunkProgress(runtime)
      } catch (error) {
        const message = error instanceof Error ? error.message : tMain('err.transcribeFailed')
        console.error(`${runtime.label} transcription failed:`, error)
        if (runtime.lastError !== message) {
          reportError(message, false)
          runtime.lastError = message
        }
      }
    }
  } finally {
    runtime.processing = false
    sendChunkProgress(runtime)
    resolveChunkIdle(runtime)
  }
}

function startChunked(label: string, engine: ChunkedEngine, chunkSeconds: number) {
  const seconds = Number.isFinite(chunkSeconds) ? chunkSeconds : 5
  if (seconds < 3 || seconds > 15) {
    throw new Error(tMain('err.chunkRange'))
  }

  chunkedRuntime = {
    engine,
    label,
    chunkBytes: Math.round(seconds * PCM_BYTES_PER_SECOND),
    pending: Buffer.alloc(0),
    queue: [],
    processing: false,
    stopping: false,
    idleResolvers: [],
    lastError: null,
    processedChunks: 0
  }
  sendChunkProgress(chunkedRuntime)
}

async function stopChunked(runtime: ChunkedRuntime): Promise<void> {
  runtime.stopping = true
  if (runtime.pending.length > 0) {
    enqueueChunk(runtime, runtime.pending)
    runtime.pending = Buffer.alloc(0)
  }
  await waitForChunkIdle(runtime)

  if (chunkedRuntime === runtime) {
    chunkedRuntime = null
    sendToRenderer('transcription-stopped')
  }
}

function buildChunkedEngine(options: TranscriptionStartOptions): {
  label: string
  engine: ChunkedEngine
} {
  const modelSize = (options.modelSize || 'base') as LocalAsrModelSize
  const languageInput = (options.language || 'auto') as string
  const language = (
    (LOCAL_ASR_LANGUAGES as readonly string[]).includes(languageInput) ? languageInput : 'auto'
  ) as LocalAsrLanguage
  // whisper-cli errors surface at start when the engine/model is missing
  return { label: tMain('label.localModel'), engine: { kind: 'wcpp', modelSize, language } }
}

async function startTranscription(options: TranscriptionStartOptions): Promise<void> {
  if (chunkedRuntime) {
    throw new Error(tMain('err.alreadyRunning'))
  }

  resetTranscriptionText()
  sendToRenderer('transcription-cleared')

  const chunkSeconds = options.chunkSeconds ?? 5
  const { label, engine } = buildChunkedEngine(options)
  startChunked(label, engine, chunkSeconds)
}

async function stopTranscription(): Promise<TranscriptionStopResult> {
  if (chunkedRuntime) {
    await stopChunked(chunkedRuntime)
  }
  return { text: getTranscriptionText() }
}

function handleAudioChunk(chunk: ArrayBuffer) {
  if (!chunkedRuntime || chunkedRuntime.stopping) return

  const runtime = chunkedRuntime
  runtime.pending = Buffer.concat([runtime.pending, Buffer.from(chunk)])
  while (runtime.pending.length >= runtime.chunkBytes) {
    const nextChunk = Buffer.from(runtime.pending.subarray(0, runtime.chunkBytes))
    runtime.pending = Buffer.from(runtime.pending.subarray(runtime.chunkBytes))
    enqueueChunk(runtime, nextChunk)
  }
}

export function getTranscriptionText(): string {
  return accumulatedText
}

export function clearTranscriptionText() {
  resetTranscriptionText()
}

ipcMain.handle('start-transcription', (_event, options: TranscriptionStartOptions) => {
  return startTranscription(options)
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

ipcMain.handle('stop-transcription', () => {
  return stopTranscription()
})

ipcMain.on('transcription-audio-chunk', (_event, chunk: ArrayBuffer) => {
  handleAudioChunk(chunk)
})

ipcMain.handle('get-transcription-text', () => {
  return getTranscriptionText()
})

ipcMain.handle('clear-transcription-text', () => {
  clearTranscriptionText()
  sendToRenderer('transcription-cleared')
})
