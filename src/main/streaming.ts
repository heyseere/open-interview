import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { ModelMessage } from 'ai'
import { takeScreenshot } from './take-screenshot'
import { saveScreenshotToDisk } from './save-screenshot'
import { getSolutionStream, getGeneralStream } from './ai'
import { extractErrorMessage } from './errors'
import {
  appendImage,
  appendText,
  commitTurn,
  createConversationState,
  isActive,
  resetConversation,
  startWithImage,
  startWithText
} from './conversation'
import {
  deleteConversation,
  endTurn,
  getConversation,
  listConversations,
  upsertSession,
  type ConversationRecord
} from './conversation-history'
import { state } from './state'
import { settings } from './settings'
import { tMain } from './i18n'

type AbortReason = 'user' | 'new-request'

interface StreamContext {
  controller: AbortController
  reason: AbortReason | null
}

type StreamMode = 'solution' | 'general'

let currentStreamContext: StreamContext | null = null

// Conversation state (see ./conversation.ts for the state machine)
const conversation = createConversationState()

/**
 * Snapshot of the most recent request, used by the one-click retry flow
 * (`retry-solution-stream`). Failed attempts never mutate committed history,
 * so replaying this snapshot is always safe.
 */
let lastRequest: { messages: ModelMessage[]; mode: StreamMode } | null = null

/** Text-only transcript of the in-progress session (persisted per turn). */
let currentSessionRecord: ConversationRecord | null = null

/**
 * Monotonic sequence used as a "latest request wins" guard. Each operation
 * captures the current sequence; after any `await`, it re-checks the sequence
 * and abandons the operation if a newer request has started, so a slow
 * screenshot capture can never clobber a newer request's conversation state.
 */
let requestSequence = 0

/** Whether the renderer has an active conversation (screenshot or text). */
export function hasActiveConversation(): boolean {
  return isActive(conversation)
}

function abortCurrentStream(reason: AbortReason) {
  if (!currentStreamContext) return
  currentStreamContext.reason = reason
  currentStreamContext.controller.abort()
}

/** User-facing stop (shortcut / button). */
export function stopCurrentStream() {
  abortCurrentStream('user')
}

function isReady(mainWindow: BrowserWindow | undefined): mainWindow is BrowserWindow {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && state.inCoderPage && settings.apiKey)
}

/** Coalesce tiny chunks into fewer IPC messages (~80ms batches). */
const IPC_FLUSH_MS = 80

/**
 * Run a single AI text stream to completion, managing the abort controller,
 * loading indicators and all lifecycle IPC events. Returns true when the
 * stream finished naturally (and `onComplete` was invoked).
 */
async function runStream(
  mainWindow: BrowserWindow,
  getStream: (signal: AbortSignal) => AsyncIterable<string>,
  onComplete: (assistantResponse: string) => void
): Promise<boolean> {
  const streamContext: StreamContext = {
    controller: new AbortController(),
    reason: null
  }
  currentStreamContext = streamContext
  mainWindow.webContents.send('ai-loading-start')

  let assistantResponse = ''
  let errored = false
  let sendBuffer = ''
  let flushTimer: NodeJS.Timeout | null = null
  const flushBuffer = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (!sendBuffer) return
    mainWindow.webContents.send('solution-chunk', sendBuffer)
    sendBuffer = ''
  }

  try {
    const solutionStream = getStream(streamContext.controller.signal)
    for await (const chunk of solutionStream) {
      if (streamContext.controller.signal.aborted) break
      assistantResponse += chunk
      sendBuffer += chunk
      if (!flushTimer) {
        flushTimer = setTimeout(flushBuffer, IPC_FLUSH_MS)
      }
    }
  } catch (error) {
    if (!streamContext.controller.signal.aborted) {
      errored = true
      console.error('Error streaming solution:', error)
      flushBuffer()
      mainWindow.webContents.send(
        'solution-error',
        extractErrorMessage(error, tMain('err.unknown'))
      )
    }
  } finally {
    // Deliver any buffered tail (also covers the aborted path) before the
    // lifecycle end events reach the renderer.
    flushBuffer()
    if (currentStreamContext === streamContext) currentStreamContext = null
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('ai-loading-end')
  }

  if (streamContext.controller.signal.aborted) {
    if (streamContext.reason === 'user') mainWindow.webContents.send('solution-stopped')
    return false
  }
  if (errored) return false

  onComplete(assistantResponse)
  mainWindow.webContents.send('solution-complete')
  return true
}

/**
 * Run one conversation turn against the given immutable request snapshot.
 * Records the request for retry and commits the assistant response on success.
 */
async function runConversationTurn(
  mainWindow: BrowserWindow,
  requestMessages: ModelMessage[],
  mode: StreamMode
): Promise<boolean> {
  lastRequest = { messages: requestMessages, mode }
  return runStream(
    mainWindow,
    (signal) =>
      mode === 'general'
        ? getGeneralStream(requestMessages, signal)
        : getSolutionStream(requestMessages, signal),
    (assistantResponse) => {
      commitTurn(conversation, requestMessages, assistantResponse)
      if (assistantResponse) {
        currentSessionRecord = endTurn(currentSessionRecord, requestMessages, assistantResponse)
        void upsertSession(currentSessionRecord)
      }
    }
  )
}

function emitTurnSeparator(mainWindow: BrowserWindow) {
  mainWindow.webContents.send('solution-chunk', '\n\n---\n\n')
}

function clearConversationUi(mainWindow: BrowserWindow) {
  mainWindow.webContents.send('solution-clear')
  mainWindow.webContents.send('screenshots-updated', [])
}

/** Send a standalone text message (used by transcription toggle-off and follow-ups). */
export async function sendTextMessage(text: string) {
  const mainWindow = global.mainWindow
  if (!isReady(mainWindow)) {
    return { success: false, error: tMain('err.notReady') }
  }
  const question = text.trim()
  if (!question) return { success: false, error: tMain('err.emptyTranscript') }

  abortCurrentStream('new-request')
  const isNewConversation = !isActive(conversation)

  let requestMessages: ModelMessage[]
  if (isNewConversation) {
    currentSessionRecord = null
    requestMessages = startWithText(conversation, question)
    clearConversationUi(mainWindow)
  } else {
    emitTurnSeparator(mainWindow)
    requestMessages = appendText(conversation, question)
  }

  const success = await runConversationTurn(mainWindow, requestMessages, 'solution')
  return success ? { success: true } : { success: false, error: tMain('err.generateFailed') }
}

/** Retry the most recent request (after a failure or a manual stop). */
export async function retryLastRequest() {
  const mainWindow = global.mainWindow
  if (!isReady(mainWindow)) {
    return { success: false, error: tMain('err.notReady') }
  }
  if (!lastRequest) return { success: false, error: tMain('err.nothingToRetry') }

  abortCurrentStream('new-request')
  if (isActive(conversation)) emitTurnSeparator(mainWindow)

  const success = await runConversationTurn(mainWindow, lastRequest.messages, lastRequest.mode)
  return success ? { success: true } : { success: false, error: tMain('err.retryFailed') }
}

/** Drop the current conversation entirely (renderer "new session" action). */
export async function startNewConversation() {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  abortCurrentStream('new-request')
  currentSessionRecord = null
  resetConversation(conversation)
  lastRequest = null
  clearConversationUi(mainWindow)
}

/** Capture a screenshot and start a brand-new conversation + stream. */
export async function startNewScreenshotSession(): Promise<void> {
  const mainWindow = global.mainWindow
  if (!isReady(mainWindow)) return

  const seq = ++requestSequence
  abortCurrentStream('new-request')
  const screenshotData = await takeScreenshot()
  if (!screenshotData || mainWindow.isDestroyed() || seq !== requestSequence) return

  saveScreenshotToDisk(screenshotData)
  currentSessionRecord = null
  const requestMessages = startWithImage(conversation, screenshotData)
  mainWindow.webContents.send('solution-clear')
  mainWindow.webContents.send('screenshots-updated', conversation.screenshots)
  mainWindow.webContents.send('screenshot-taken', screenshotData)

  await runConversationTurn(mainWindow, requestMessages, 'solution')
}

/** Capture a screenshot and append it to the existing conversation. */
export async function appendScreenshotSession(): Promise<void> {
  const mainWindow = global.mainWindow
  if (!isReady(mainWindow)) return

  // Fallback to a new conversation if no conversation exists yet
  if (!isActive(conversation)) {
    await startNewScreenshotSession()
    return
  }

  const seq = ++requestSequence
  abortCurrentStream('new-request')
  const screenshotData = await takeScreenshot()
  if (!screenshotData || mainWindow.isDestroyed() || seq !== requestSequence) return

  saveScreenshotToDisk(screenshotData)
  const requestMessages = appendImage(conversation, screenshotData)
  mainWindow.webContents.send('screenshot-taken', screenshotData)
  mainWindow.webContents.send('screenshots-updated', conversation.screenshots)
  emitTurnSeparator(mainWindow)

  await runConversationTurn(mainWindow, requestMessages, 'general')
}

ipcMain.handle('stopSolutionStream', () => {
  if (!currentStreamContext) return false
  abortCurrentStream('user')
  return true
})

ipcMain.handle('sendFollowUpQuestion', async (_event, question: string) => {
  if (!hasActiveConversation()) {
    return { success: false, error: tMain('err.noConversation') }
  }
  return sendTextMessage(question)
})

ipcMain.handle('send-text-message', (_event, text: string) => {
  return sendTextMessage(text)
})

ipcMain.handle('has-active-conversation', () => hasActiveConversation())

ipcMain.handle('retry-solution-stream', () => retryLastRequest())

ipcMain.handle('new-conversation', () => startNewConversation())

ipcMain.handle('list-conversations', () => listConversations())

ipcMain.handle('get-conversation', (_event, id: string) => getConversation(id))

ipcMain.handle('delete-conversation', (_event, id: string) => deleteConversation(id))

/**
 * Whitelisted renderer-triggered actions (hover toolbar). Transcription is
 * routed through the existing `toggle-transcription` event so the renderer
 * pipeline (incl. VAD arming) stays in one place.
 */
const TRIGGERABLE_ACTIONS: Record<string, () => void | Promise<void>> = {
  takeScreenshot: () => startNewScreenshotSession(),
  appendScreenshot: () => appendScreenshotSession(),
  stopSolutionStream: () => stopCurrentStream(),
  newConversation: () => startNewConversation(),
  toggleTranscription: () => {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-transcription')
    }
  },
  // Stop the running transcription WITHOUT submitting the accumulated text
  cancelTranscription: () => {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cancel-transcription')
    }
  },
  // Stop the running transcription and submit the accumulated text right away
  submitTranscription: () => {
    const mainWindow = global.mainWindow
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('submit-transcription')
    }
  }
}

ipcMain.handle('trigger-action', async (_event, action: unknown) => {
  const handler = typeof action === 'string' ? TRIGGERABLE_ACTIONS[action] : undefined
  if (!handler) return { success: false, error: tMain('err.unknownAction') }
  try {
    await handler()
    return { success: true }
  } catch (error) {
    console.error(`Action ${String(action)} failed:`, error)
    return { success: false, error: tMain('err.actionFailed') }
  }
})
