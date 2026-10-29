/**
 * Pure CDP (Chrome DevTools Protocol) helpers for the full-page capture.
 *
 * Electron is deliberately not imported — this module only uses Node builtins
 * (fetch / WebSocket / net), so the parsing and planning logic stays
 * unit-testable exactly like window-bounds.ts. The Electron glue (Chrome
 * discovery, launch, image resizing via nativeImage, IPC) lives in
 * chrome-fullpage.ts.
 */

/** A /json/list target entry we care about (only page-type tabs survive). */
export interface CdpTarget {
  id: string
  type: string
  url: string
  title: string
  webSocketDebuggerUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Pick the capture candidates from a /json/list body, preserving order.
 * The list order is NOT a reliable focus signal (see pickActiveTarget) —
 * callers decide which candidate is the "current" tab. DevTools windows
 * mirror their inspected tab as separate targets and are excluded.
 */
export function parseTargets(body: unknown): CdpTarget[] {
  if (!Array.isArray(body)) return []
  const targets: CdpTarget[] = []
  for (const entry of body) {
    if (!isRecord(entry)) continue
    if (entry.type !== 'page') continue
    if (typeof entry.id !== 'string') continue
    if (typeof entry.webSocketDebuggerUrl !== 'string' || !entry.webSocketDebuggerUrl) continue
    const url = typeof entry.url === 'string' ? entry.url : ''
    if (url.startsWith('devtools://')) continue
    targets.push({
      id: entry.id,
      type: entry.type,
      url,
      title: typeof entry.title === 'string' ? entry.title : '',
      webSocketDebuggerUrl: entry.webSocketDebuggerUrl
    })
  }
  return targets
}

/**
 * Decide whether a process command line belongs to OUR dedicated exam
 * Chrome: it must carry BOTH the debug port and OUR profile directory.
 * Strictly evidence-based — a browser that merely listens on the same port
 * (e.g. a tool-launched default-profile Chrome with remote debugging) never
 * matches, so it can never be mistaken for the exam Chrome.
 */
export function matchesExamChromeCommand(
  command: string,
  port: number,
  profileDir: string
): boolean {
  return (
    command.includes(`--remote-debugging-port=${port}`) &&
    command.includes(`--user-data-dir=${profileDir}`)
  )
}

/** Readiness payload of /json/version. */
export interface CdpVersion {
  Browser: string
}

/** Probe whether a Chrome DevTools endpoint answers on the given port. */
export async function probeVersion(port: number, timeoutMs = 1500): Promise<CdpVersion | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.Browser === 'string') {
      return { Browser: body.Browser }
    }
    return null
  } catch {
    return null
  }
}

/** Fetch and parse the target list of a debug-enabled Chrome. */
export async function listTargets(port: number, timeoutMs = 3000): Promise<CdpTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return parseTargets(await response.json())
}

/** Minimal structural typing for the Node-builtin WebSocket (Node ≥22). */
interface MinimalWebSocket {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: unknown) => void) | null
}

/**
 * One-shot CDP `Runtime.evaluate` over a short-lived WebSocket session.
 * Returns the evaluation's `result.value`, or null on any failure.
 */
export function cdpEvaluate(
  webSocketDebuggerUrl: string,
  expression: string,
  timeoutMs = 1500
): Promise<unknown> {
  const WS = globalThis.WebSocket as unknown as (new (url: string) => MinimalWebSocket) | undefined
  if (!WS) return Promise.resolve(null)
  return new Promise<unknown>((resolve) => {
    const ws = new WS(webSocketDebuggerUrl)
    let settled = false
    let requestId = 0
    const finish = (value: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // already closed
      }
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    ws.onopen = () => {
      requestId = 1
      ws.send(
        JSON.stringify({
          id: requestId,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true }
        })
      )
    }
    ws.onmessage = (event) => {
      let message: unknown
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!isRecord(message) || message.id !== requestId) return
      const result = message.result
      if (!message.error && isRecord(result) && isRecord(result.result)) {
        finish(result.result.value ?? null)
      } else {
        finish(null)
      }
    }
    ws.onerror = () => finish(null)
    ws.onclose = () => finish(null)
  })
}

/** Visibility/focus snapshot of one tab. */
export interface TabFocus {
  visible: boolean
  focused: boolean
}

export type TabFocusProber = (webSocketDebuggerUrl: string) => Promise<TabFocus | null>

async function defaultProbeTabFocus(webSocketDebuggerUrl: string): Promise<TabFocus | null> {
  const value = await cdpEvaluate(
    webSocketDebuggerUrl,
    '({ v: document.visibilityState, f: document.hasFocus() })'
  )
  if (!isRecord(value) || typeof value.v !== 'string') return null
  return { visible: value.v === 'visible', focused: value.f === true }
}

/** How many /json/list candidates are probed for focus (in list order). */
export const ACTIVE_TAB_PROBE_LIMIT = 6

/**
 * Pick the tab to capture. /json/list order alone is not a guaranteed focus
 * signal with several tabs/windows open, so the first `probeLimit` page
 * targets are probed in parallel for `visibilityState` + `hasFocus()`:
 * the tab the user is looking at is `visible` in its window and `focused`
 * when Chrome is frontmost. Scoring: focused+visible (3) > visible (1) >
 * hidden/unreachable (0); ties and total probe failure fall back to the
 * first listed target.
 */
export async function pickActiveTarget(
  targets: CdpTarget[],
  probe: TabFocusProber = defaultProbeTabFocus,
  probeLimit = ACTIVE_TAB_PROBE_LIMIT
): Promise<CdpTarget | null> {
  if (targets.length === 0) return null
  const candidates = targets.slice(0, Math.max(1, probeLimit))
  const focusResults = await Promise.all(
    candidates.map(async (target) => {
      try {
        return await probe(target.webSocketDebuggerUrl)
      } catch {
        return null
      }
    })
  )
  let bestIndex = -1
  let bestScore = 0
  focusResults.forEach((focus, index) => {
    if (!focus) return
    const score = focus.visible ? (focus.focused ? 3 : 1) : 0
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })
  return bestIndex >= 0 ? candidates[bestIndex] : targets[0]
}

/**
 * Attach to a page target, capture the FULL page and detach.
 *
 * Page.captureScreenshot with captureBeyondViewport composites the whole page
 * in the browser compositor: no viewport resize, no scroll, no DOM events,
 * nothing visible changes on screen. Debugger.setSkipAllPauses is sent right
 * after attach so anti-debug pages looping `debugger` statements cannot
 * freeze the tab while we are attached (any stray Debugger.paused is resumed
 * as well). Returns base64 PNG.
 */
export function cdpCaptureFullPage(
  webSocketDebuggerUrl: string,
  timeoutMs = 20000
): Promise<string> {
  const WS = globalThis.WebSocket as unknown as (new (url: string) => MinimalWebSocket) | undefined
  if (!WS) {
    return Promise.reject(new Error('WebSocket is not available in this runtime'))
  }
  return new Promise<string>((resolve, reject) => {
    const ws = new WS(webSocketDebuggerUrl)
    let nextId = 0
    let captureId = 0
    let settled = false
    const pending = new Map<number, () => void>()

    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        // already closed
      }
      settle()
    }
    const fail = (error: Error) => finish(() => reject(error))

    const timer = setTimeout(() => fail(new Error(`CDP timed out after ${timeoutMs}ms`)), timeoutMs)

    // Command responses resolve through `pending`; only the capture command's
    // result carries data, the rest are acknowledged and ignored.
    const send = (method: string, params?: Record<string, unknown>) => {
      const id = ++nextId
      pending.set(id, () => {})
      ws.send(JSON.stringify({ id, method, params: params ?? {} }))
      return id
    }

    ws.onopen = () => {
      send('Debugger.setSkipAllPauses', { skip: true })
      captureId = send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true
      })
    }

    ws.onmessage = (event) => {
      let message: unknown
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!isRecord(message)) return
      if (typeof message.id === 'number' && pending.has(message.id)) {
        const settle = pending.get(message.id)
        pending.delete(message.id)
        settle?.()
        if (message.id === captureId) {
          const result = message.result
          if (message.error) {
            fail(
              new Error(
                isRecord(message.error) && typeof message.error.message === 'string'
                  ? message.error.message
                  : 'CDP error'
              )
            )
          } else if (isRecord(result) && typeof result.data === 'string' && result.data) {
            finish(() => resolve(result.data as string))
          } else {
            fail(new Error('CDP returned no screenshot data'))
          }
        }
      } else if (message.method === 'Debugger.paused') {
        // Anti-debug trap fired between attach and setSkipAllPauses taking
        // effect — resume so the tab never visibly freezes.
        send('Debugger.resume')
      }
    }

    ws.onerror = () => fail(new Error('CDP connection failed'))
    ws.onclose = () => fail(new Error('CDP connection closed before the capture finished'))
  })
}
