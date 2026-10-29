import { ipcMain, systemPreferences } from 'electron'
import type { BrowserWindow } from 'electron'
import type { ModelMessage } from 'ai'
import { saveScreenshotToDisk, takeScreenshot } from './screenshot'
import { toErrorMessage } from './renderer-send'
import { captureFullPage, type ChromeFullPageCapture } from './chrome-fullpage'
import { getSolutionStream, getGeneralStream, type ModelStream } from './ai'
import { classifyApiError, extractErrorMessage } from './errors'
import type { SolutionErrorPayload } from '../shared/solution-error'
import { planStreamTail, planTurnEnd } from './stream-guard'
import {
  appendImage,
  appendText,
  commitTurn,
  createConversationState,
  deleteConversation,
  endTurn,
  getConversation,
  getLengths,
  isActive,
  listConversations,
  resetConversation,
  rollbackTo,
  startWithImage,
  startWithText,
  upsertSession,
  type ConversationRecord
} from './conversation'
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
 * Monotonic sequence used as a "latest request wins" guard. EVERY entry —
 * screenshot capture, text message, retry and session reset — captures the
 * current sequence; after any `await`, it re-checks the sequence and abandons
 * the operation if a newer request has started, so a slow screenshot capture
 * can never clobber a newer request's conversation state (and vice versa).
 */
let requestSequence = 0

/** Whether the renderer has an active conversation (screenshot or text). */
function hasActiveConversation(): boolean {
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
  // Local providers (Ollama/LM Studio) legitimately run without a key, so
  // readiness requires a configured endpoint + model instead of a key.
  return Boolean(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    state.inCoderPage &&
    settings.apiBaseURL &&
    settings.model
  )
}

/**
 * Surface a "not configured" failure on the renderer error banner, pointing
 * at the provider section instead of the dead-end "app is not ready" text.
 */
function notifyNotReady(mainWindow: BrowserWindow | undefined): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('solution-error', {
      message: tMain('err.notReady'),
      action: 'open-settings'
    } satisfies SolutionErrorPayload)
  }
}

/**
 * Localized message + repair affordance for one API failure. Known kinds get
 * their own text and action; unknown failures keep the provider's raw message
 * (for e.g. a missing model name that is the most useful text available).
 */
function apiErrorMessage(error: unknown): SolutionErrorPayload {
  switch (classifyApiError(error)) {
    case 'auth':
      return { message: tMain('err.apiAuthFailed'), action: 'open-settings' }
    case 'rate-limit':
      return { message: tMain('err.apiRateLimited'), action: 'retry' }
    case 'server':
      return { message: tMain('err.apiServerError'), action: 'retry' }
    case 'network':
      return { message: tMain('err.apiNetworkFailed'), action: 'retry' }
    case 'timeout':
      return { message: tMain('err.apiTimeout'), action: 'retry' }
    default:
      return { message: extractErrorMessage(error, tMain('err.unknown')), action: 'retry' }
  }
}

/** Outcome of one stream run. */
interface StreamResult {
  ok: boolean
  /** True when the user aborted on purpose (already reported as `solution-stopped`). */
  stoppedByUser: boolean
  /** The conversation must be rolled back to the pre-turn lengths. */
  rollback: boolean
}

/** Coalesce tiny chunks into fewer IPC messages (~80ms batches). */
const IPC_FLUSH_MS = 80

/**
 * Run a single AI text stream to completion, managing the abort controller,
 * loading indicators and all lifecycle IPC events. Returns ok=false when the
 * stream failed or was aborted (`stoppedByUser` distinguishes the latter).
 * `seq` is the caller's request generation: a run aborted because a newer
 * request started must not flush its buffered tail or end loading over the
 * successor's UI events.
 */
async function runStream(
  mainWindow: BrowserWindow,
  getStream: (signal: AbortSignal) => ModelStream,
  onComplete: (assistantResponse: string) => void,
  seq: number
): Promise<StreamResult> {
  const streamContext: StreamContext = {
    controller: new AbortController(),
    reason: null
  }
  currentStreamContext = streamContext
  mainWindow.webContents.send('ai-loading-start')

  let assistantResponse = ''
  let caughtError: unknown = null
  let streamError: unknown = null
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
    if (!streamContext.controller.signal.aborted) caughtError = error
  } finally {
    // Tail disposition comes from the pure guard: a successor stream already
    // sent ai-loading-start, so this run must not append its tail to the
    // successor's text or end the successor's loading; a session reset
    // (stale seq, no successor) drops the tail but still ends loading.
    const tail = planStreamTail({
      replaced: currentStreamContext !== streamContext,
      stale: seq !== requestSequence
    })
    if (tail.flushTail) flushBuffer()
    else if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (currentStreamContext === streamContext) currentStreamContext = null
    if (tail.sendLoadingEnd && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-loading-end')
    }
  }

  // ai@5 never lets provider-reported error parts escape textStream (they are
  // recorded in onError instead), so a mid-stream failure would otherwise end
  // here looking like a complete answer. An aborted stream stays silent: the
  // successor (or the stop path) owns the UI now.
  if (caughtError === null && !streamContext.controller.signal.aborted) {
    streamError = stream.getError()
  }

  const plan = planTurnEnd({
    stale: seq !== requestSequence,
    aborted: streamContext.controller.signal.aborted,
    stoppedByUser: streamContext.reason === 'user',
    errored: caughtError !== null || streamError !== null,
    errorSource: caughtError !== null ? 'caught' : streamError !== null ? 'stream' : null,
    empty: !assistantResponse
  })

  if (plan.sendError && !mainWindow.isDestroyed()) {
    const error = caughtError ?? streamError
    if (error !== null) console.error('Stream failed:', error)
    mainWindow.webContents.send(
      'solution-error',
      plan.errorSource === 'empty'
        ? ({ message: tMain('err.generateFailed'), action: 'retry' } satisfies SolutionErrorPayload)
        : apiErrorMessage(error)
    )
  }
  if (plan.sendStopped && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('solution-stopped')
  }
  if (plan.commit) {
    onComplete(assistantResponse)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('solution-complete')
  }
  return { ok: plan.ok, stoppedByUser: plan.sendStopped, rollback: plan.rollback }
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
  mode: StreamMode,
  seq: number
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
      if (seq !== requestSequence) return
      commitTurn(conversation, requestMessages, assistantResponse)
      if (assistantResponse) {
        currentSessionRecord = endTurn(currentSessionRecord, requestMessages, assistantResponse)
        void upsertSession(currentSessionRecord)
      }
    },
    seq
  )
  // A newer request owns the conversation now (it aborted this stream and
  // may have rebuilt the state): rolling back would clobber its turn.
  if (result.rollback && seq === requestSequence) {
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

  const entry = beginTurn(mainWindow)
  if (!entry) return { success: false, error: tMain('err.notReady') }
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

  const result = await runConversationTurn(mainWindow, requestMessages, 'solution', entry.seq)
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

  const entry = beginTurn(mainWindow)
  if (!entry) return { success: false, error: tMain('err.notReady') }
  if (isActive(conversation)) emitTurnSeparator(mainWindow)

  const result = await runConversationTurn(
    mainWindow,
    lastRequest.messages,
    lastRequest.mode,
    entry.seq
  )
  if (result.ok || result.stoppedByUser) return { success: true }
  return { success: false, error: tMain('err.retryFailed') }
}

/** Drop the current conversation entirely (renderer "new session" action). */
export async function startNewConversation() {
  const mainWindow = global.mainWindow
  if (!mainWindow || mainWindow.isDestroyed()) return
  // A reset is itself a "latest wins" operation: bump the sequence so an
  // in-flight turn neither flushes its tail over the cleared UI (stale
  // runStream) nor rolls the fresh state back (stale turn).
  requestSequence += 1
  abortCurrentStream('new-request')
  currentSessionRecord = null
  resetConversation(conversation)
  lastRequest = null
  clearConversationUi(mainWindow)
}

/**
 * Shared tail of every screenshot-entry flow: register the images with the
 * conversation state machine (one turn, one image — the full-page capture
 * already arrives as a single native image), push the renderer UI events and
 * run the turn. Callers own the request-sequence guard and pass it in for a
 * final re-check.
 */
async function runScreenshotTurn(
  mainWindow: BrowserWindow,
  images: string[],
  seq: number
): Promise<void> {
  if (mainWindow.isDestroyed() || seq !== requestSequence) return

  currentSessionRecord = null
  const requestMessages = startWithImage(conversation, images)
  mainWindow.webContents.send('solution-clear')
  mainWindow.webContents.send('screenshots-updated', conversation.screenshots)
  mainWindow.webContents.send('screenshot-taken', images[0])

  await runConversationTurn(mainWindow, requestMessages, 'solution', seq)
}

/**
 * Shared prologue of every request entry — screenshot or text: bump the
 * request sequence and abort the previous stream. Returns null when the
 * entry must stop; readiness is the caller's job so each surface can pick
 * its failure feedback (error banner vs returned error object).
 */
function beginTurn(mainWindow: BrowserWindow | undefined): {
  mainWindow: BrowserWindow
  seq: number
} | null {
  if (!isReady(mainWindow)) return null
  const seq = ++requestSequence
  abortCurrentStream('new-request')
  return { mainWindow, seq }
}

/**
 * Screenshot entries have no return channel: surface the not-ready case on
 * the renderer error banner (shortcut/toolbar callers).
 */
function beginScreenshotEntry(mainWindow: BrowserWindow | undefined) {
  const entry = beginTurn(mainWindow)
  if (!entry) notifyNotReady(mainWindow)
  return entry
}

/**
 * Take the screenshot and guard the post-await window: the user may have
 * started another request (or closed the window) while the capture ran.
 */
async function takeGuardedScreenshot(
  mainWindow: BrowserWindow,
  seq: number
): Promise<string | null> {
  const screenshotData = await takeScreenshot()
  if (!screenshotData) {
    emitCaptureFailure(mainWindow, seq)
    return null
  }
  if (mainWindow.isDestroyed() || seq !== requestSequence) return null
  saveScreenshotToDisk(screenshotData)
  return screenshotData
}

/**
 * A null capture used to fail silently — and on macOS a missing
 * screen-recording permission produces exactly that (an empty thumbnail), so
 * the core flow gave the user zero feedback. Distinguish the permission case
 * (repairable via the permissions page) from a genuinely empty capture.
 */
function emitCaptureFailure(mainWindow: BrowserWindow, seq: number): void {
  if (mainWindow.isDestroyed() || seq !== requestSequence) return
  const permitted =
    process.platform !== 'darwin' || systemPreferences.getMediaAccessStatus('screen') === 'granted'
  mainWindow.webContents.send(
    'solution-error',
    permitted
      ? ({ message: tMain('err.captureEmpty') } satisfies SolutionErrorPayload)
      : ({
          message: tMain('err.screenPermissionDenied'),
          action: 'open-permissions'
        } satisfies SolutionErrorPayload)
  )
}

/** Capture a screenshot and start a brand-new conversation + stream. */
export async function startNewScreenshotSession(): Promise<void> {
  const entry = beginScreenshotEntry(global.mainWindow)
  if (!entry) return
  const screenshotData = await takeGuardedScreenshot(entry.mainWindow, entry.seq)
  if (!screenshotData) return

  await runScreenshotTurn(entry.mainWindow, [screenshotData], entry.seq)
}

/**
 * Full-page capture of the dedicated exam Chrome (see chrome-fullpage.ts):
 * always starts a NEW conversation — one captured page is one question —
 * with the whole page submitted as a single image.
 */
export async function submitFullPageCapture(): Promise<void> {
  const entry = beginScreenshotEntry(global.mainWindow)
  if (!entry) return
  const { mainWindow, seq } = entry

  let capture: ChromeFullPageCapture
  try {
    capture = await captureFullPage()
  } catch (error) {
    console.error('Full-page capture failed:', error)
    if (!mainWindow.isDestroyed() && seq === requestSequence) {
      mainWindow.webContents.send('solution-error', {
        message: toErrorMessage(error, tMain('err.unknown'))
      } satisfies SolutionErrorPayload)
    }
    return
  }
  if (mainWindow.isDestroyed() || seq !== requestSequence || !capture.image) return

  await runScreenshotTurn(mainWindow, [capture.image], seq)
}

/** Capture a screenshot and append it to the existing conversation. */
export async function appendScreenshotSession(): Promise<void> {
  // Fallback to a new conversation if no conversation exists yet
  if (!isActive(conversation)) {
    await startNewScreenshotSession()
    return
  }

  const entry = beginScreenshotEntry(global.mainWindow)
  if (!entry) return
  const { mainWindow, seq } = entry

  const screenshotData = await takeGuardedScreenshot(mainWindow, seq)
  if (!screenshotData) return

  const requestMessages = appendImage(conversation, screenshotData)
  mainWindow.webContents.send('screenshot-taken', screenshotData)
  mainWindow.webContents.send('screenshots-updated', conversation.screenshots)
  emitTurnSeparator(mainWindow)

  await runConversationTurn(mainWindow, requestMessages, 'general', seq)
}

ipcMain.handle('sendFollowUpQuestion', async (_event, question: unknown) => {
  if (!hasActiveConversation()) {
    return { success: false, error: tMain('err.noConversation') }
  }
  // Non-strings become the empty-question failure inside sendTextMessage
  return sendTextMessage(typeof question === 'string' ? question : '')
})

ipcMain.handle('send-text-message', (_event, text: unknown) => {
  return sendTextMessage(typeof text === 'string' ? text : '')
})

ipcMain.handle('has-active-conversation', () => hasActiveConversation())

ipcMain.handle('retry-solution-stream', () => retryLastRequest())

ipcMain.handle('list-conversations', () => listConversations())

ipcMain.handle('get-conversation', (_event, id: string) => getConversation(id))

ipcMain.handle('delete-conversation', async (_event, id: string) => {
  const result = await deleteConversation(id)
  // A deleted in-progress session must not be resurrected by the next
  // turn's upsertSession(currentSessionRecord)
  if (currentSessionRecord?.id === id) currentSessionRecord = null
  return result
})
