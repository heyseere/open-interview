import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { ModelMessage } from 'ai'
import { takeScreenshot } from './take-screenshot'
import { saveScreenshotToDisk } from './save-screenshot'
import { getSolutionStream, getGeneralStream, type ModelStream } from './ai'
import { extractErrorMessage } from './errors'
import {
  appendImage,
  appendText,
  commitTurn,
  createConversationState,
  getLengths,
  isActive,
  resetConversation,
  rollbackTo,
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

/** Surface a "not configured" failure on the renderer error banner. */
function notifyNotReady(mainWindow: BrowserWindow | undefined): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('solution-error', tMain('err.notReady'))
  }
}

/** Outcome of one stream run. */
interface StreamResult {
  ok: boolean
  /** True when the user aborted on purpose (already reported as `solution-stopped`). */
  stoppedByUser: boolean
}

/** Coalesce tiny chunks into fewer IPC messages (~80ms batches). */
const IPC_FLUSH_MS = 80

/**
 * Run a single AI text stream to completion, managing the abort controller,
 * loading indicators and all lifecycle IPC events. Returns ok=false when the
 * stream failed or was aborted (`stoppedByUser` distinguishes the latter).
 */
async function runStream(
  mainWindow: BrowserWindow,
  getStream: (signal: AbortSignal) => ModelStream,
  onComplete: (assistantResponse: string) => void
): Promise<StreamResult> {
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

  const stream = getStream(streamContext.controller.signal)
  try {
    for await (const chunk of stream.textStream) {
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
    const stoppedByUser = streamContext.reason === 'user'
    if (stoppedByUser) mainWindow.webContents.send('solution-stopped')
    return { ok: false, stoppedByUser }
  }

  // ai@5 never lets provider-reported error parts escape textStream (they are
  // recorded in onError instead), so a mid-stream failure would otherwise end
  // here looking like a complete answer
  if (!errored) {
    const streamError = stream.getError()
    if (streamError) {
      errored = true
      console.error('Stream reported an error:', streamError)
      mainWindow.webContents.send(
        'solution-error',
        extractErrorMessage(streamError, tMain('err.unknown'))
      )
    }
  }
  if (errored) return { ok: false, stoppedByUser: false }

  onComplete(assistantResponse)
  mainWindow.webContents.send('solution-complete')
  return { ok: true, stoppedByUser: false }
}

/**
 * Run one conversation turn against the given immutable request snapshot.
 * Records the request for retry and commits the assistant response on success.
 * A failed turn is rolled back so no dangling unanswered user message stays
 * behind in the conversation.
 */
async function runConversationTurn(
  mainWindow: BrowserWindow,
  requestMessages: ModelMessage[],
  mode: StreamMode
): Promise<StreamResult> {
  lastRequest = { messages: requestMessages, mode }
  const lengthsBefore = getLengths(conversation)
  const result = await runStream(
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
  if (!result.ok && !result.stoppedByUser) {
    rollbackTo(conversation, lengthsBefore)
  }
  return result
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

  const result = await runConversationTurn(mainWindow, requestMessages, 'solution')
  // A user-initiated stop already surfaced `solution-stopped` in the UI and
  // must not come back as a failure
  if (result.ok || result.stoppedByUser) return { success: true }
  return { success: false, error: tMain('err.generateFailed') }
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

  const result = await runConversationTurn(mainWindow, lastRequest.messages, lastRequest.mode)
  if (result.ok || result.stoppedByUser) return { success: true }
  return { success: false, error: tMain('err.retryFailed') }
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
  if (!isReady(mainWindow)) {
    // Give shortcut and toolbar callers visible feedback instead of a no-op
    notifyNotReady(mainWindow)
    return
  }

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
  if (!isReady(mainWindow)) {
    notifyNotReady(mainWindow)
    return
  }

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

ipcMain.handle('delete-conversation', async (_event, id: string) => {
  const result = await deleteConversation(id)
  // A deleted in-progress session must not be resurrected by the next
  // turn's upsertSession(currentSessionRecord)
  if (currentSessionRecord?.id === id) currentSessionRecord = null
  return result
})
