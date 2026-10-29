import { app, ipcMain, nativeImage } from 'electron'
import { spawn, execFile, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, readlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { tMain } from './i18n'
import {
  cdpCaptureFullPage,
  listTargets,
  matchesExamChromeCommand,
  pickActiveTarget,
  probeVersion,
  type CdpVersion
} from './chrome-cdp'
import { FULL_PAGE_BUDGET, encodeImageWithinBudget } from './screenshot'
import { emitToRenderer, toErrorMessage } from './renderer-send'
import { pickFreePort } from './free-port'
import {
  parsePersistedPort,
  parsePortRecord,
  parseSingletonLockPid,
  parseWindowsListenerPid
} from './exam-chrome-identity'

/**
 * Full-page capture of the dedicated "exam Chrome" via the DevTools protocol.
 *
 * The app launches the machine's OWN Chrome binary with a DEDICATED
 * user-data-dir (Chrome 136+ refuses --remote-debugging-port on the default
 * profile) and a loopback debugging port. A capture attaches to the most
 * recently active tab, sends Page.captureScreenshot(captureBeyondViewport) —
 * a compositor-level capture that fires no DOM events and changes nothing on
 * screen — and detaches immediately. No macOS/Windows permission is involved:
 * the capture happens inside Chrome, not through desktopCapturer.
 *
 * Launch flags are deliberately minimal: no --enable-automation, so
 * navigator.webdriver stays false and no "controlled by automation" infobar
 * appears. Chrome binds the debugging port to 127.0.0.1 only.
 */

const PORT_RANGE_START = 9222
const PORT_RANGE_END = 9231
const LAUNCH_TIMEOUT_MS = 20000
const READY_POLL_MS = 400
const CAPTURE_TIMEOUT_MS = 20000

export interface ChromeFullPageStatus {
  chromeFound: boolean
  running: boolean
  port: number | null
}

export interface ChromeFullPageCapture {
  /**
   * One base64 JPEG of the WHOLE page (native captureBeyondViewport render),
   * encoded within FULL_PAGE_BUDGET (see image-budget.ts).
   */
  image: string
}

// --- profile identity ---------------------------------------------------------
//
// Ownership is proved WITHOUT port scanning: any other debug-enabled Chrome on
// the well-known ports (chrome-devtools-mcp, a dev harness) must never be
// mistaken for the exam Chrome. Two signals, both rooted in OUR profile dir:
// 1. chrome-fullpage.json — the port we recorded at launch (primary; current
//    Chrome no longer writes DevToolsActivePort into the user-data-dir)
// 2. SingletonLock → `<host>-<pid>` — the RUNNING instance's pid, proving
//    which process actually owns this profile (used to verify candidates)
// DevToolsActivePort is read as a legacy fallback for older Chrome versions.

function stateFilePath(): string | null {
  try {
    return path.join(app.getPath('userData'), 'chrome-fullpage.json')
  } catch {
    return null
  }
}

function profileDir(): string {
  return path.join(app.getPath('userData'), 'chrome-profile')
}

function readPortRecord(file: string): number | null {
  try {
    if (!existsSync(file)) return null
    return parsePortRecord(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function loadPersistedPort(): number | null {
  try {
    const file = stateFilePath()
    if (!file || !existsSync(file)) return null
    return parsePersistedPort(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function persistPort(port: number): void {
  try {
    const file = stateFilePath()
    if (file) writeFileSync(file, JSON.stringify({ port }))
  } catch {
    // Persistence is best-effort; discovery still probes DevToolsActivePort
  }
}

function legacyProfileDebugPort(): number | null {
  try {
    return readPortRecord(path.join(profileDir(), 'DevToolsActivePort'))
  } catch {
    return null
  }
}

/**
 * The pid of the process owning our profile (macOS/Linux SingletonLock,
 * `<host>-<pid>`), or null when unavailable.
 */
function profileOwnerPid(): number | null {
  try {
    const lock = path.join(profileDir(), 'SingletonLock')
    if (!existsSync(lock)) return null
    // The symlink TARGET is `<hostname>-<pid>`; read the link itself, not its
    // (nonexistent) destination file
    return parseSingletonLockPid(readlinkSync(lock, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Run a probe command asynchronously. Identity checks can run on the 3s
 * heartbeat, so they must never block the main process (the old synchronous
 * synchronous execution blocked the event loop on lsof/ps, and on Windows even
 * netstat + PowerShell, for the whole lifetime of browser mode).
 */
function execText(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf-8' }, (error, stdout) => {
      resolve(error ? null : stdout)
    })
  })
}

/** Command line of a live pid, or null when it is gone / unreadable. */
async function pidCommandLine(pid: number): Promise<string | null> {
  try {
    // Linux procfs is a file read, no subprocess needed.
    return readFileSync(`/proc/${pid}/cmdline`, 'utf-8') // NUL-separated; includes() still works
  } catch {
    // macOS has no /proc — ps exits nonzero when the pid is gone
    const command = await execText('ps', ['-p', String(pid), '-o', 'command='])
    return command?.trim() ? command : null
  }
}

/**
 * Command line of the process LISTENING on `port` (loopback), or null when it
 * cannot be determined. lsof is authoritative on macOS/Linux; on Windows the
 * listener pid is parsed out of netstat and resolved via PowerShell.
 */
async function portOwnerCommandLine(port: number): Promise<string | null> {
  if (process.platform === 'win32') {
    const output = await execText('netstat', ['-ano', '-p', 'tcp'])
    if (!output) return null
    for (const line of output.split('\n')) {
      const pid = parseWindowsListenerPid(line, port)
      if (pid === null) continue
      const command = (
        await execText('powershell', [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`
        ])
      )?.trim()
      if (command) return command
    }
    return null
  }
  const output = await execText('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'])
  if (!output) return null
  for (const pid of output.split(/\s+/).filter(Boolean)) {
    const command = await pidCommandLine(Number(pid))
    if (command) return command
  }
  return null
}

/**
 * Positive proof that the browser answering on `port` is OUR exam Chrome: the
 * listening process's command line must carry both the debug port and OUR
 * user-data-dir. A responder is never accepted on weaker evidence — a missing
 * SingletonLock used to let any same-port browser (e.g. a tool-launched
 * default-profile Chrome with remote debugging) pose as the exam Chrome.
 *
 * When we still hold the pid we spawned, its own command line settles it
 * without any port lookup (fast path for the heartbeat).
 */
async function examChromeOwnsPort(port: number): Promise<boolean> {
  const spawnedPid = spawnedExamChrome?.pid
  if (spawnedPid) {
    const own = await pidCommandLine(spawnedPid)
    if (own && matchesExamChromeCommand(own, port, profileDir())) return true
  }
  const lockOwnerPid = profileOwnerPid()
  const command =
    (await portOwnerCommandLine(port)) ??
    (lockOwnerPid === null ? null : await pidCommandLine(lockOwnerPid))
  if (!command) return false
  return matchesExamChromeCommand(command, port, profileDir())
}

// --- Chrome discovery & launch ------------------------------------------------

/** Locate the installed Google Chrome binary (standard paths only). */
export function findChromeBinary(): string | null {
  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          path.join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ]
      : process.platform === 'win32'
        ? [
            path.join(
              process.env['PROGRAMFILES'] ?? 'C:\\Program Files',
              'Google/Chrome/Application/chrome.exe'
            ),
            path.join(
              process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
              'Google/Chrome/Application/chrome.exe'
            ),
            path.join(
              process.env['LOCALAPPDATA'] ?? path.join(homedir(), 'AppData/Local'),
              'Google/Chrome/Application/chrome.exe'
            )
          ]
        : []
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/**
 * Find OUR running debug instance. Candidates come from our own records only
 * (the launch-time port + the legacy DevToolsActivePort), never from port
 * scanning; each candidate must answer AND the LISTENING process must prove
 * it was started with our profile dir (examChromeOwnsPort).
 */
export async function findRunningDebugChrome(): Promise<number | null> {
  const persisted = loadPersistedPort()
  const legacy = legacyProfileDebugPort()
  const candidates = [...new Set([persisted, legacy].filter((p): p is number => p !== null))]
  for (const port of candidates) {
    if (!(await probeVersion(port))) continue
    // A responder on our recorded port is NOT enough: another Chrome (e.g.
    // launched by a browser-automation tool on the default profile) may own
    // that port by now.
    if (await examChromeOwnsPort(port)) return port
  }
  return null
}

export async function getChromeFullPageStatus(): Promise<ChromeFullPageStatus> {
  const chromeFound = findChromeBinary() !== null
  const port = await findRunningDebugChrome()
  return { chromeFound, running: port !== null, port }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- browser-mode lifecycle -----------------------------------------------------
//
// "Browser mode" = the dedicated exam Chrome is running. The renderer mirrors
// it in a zustand store (header button + toolbar icon); main keeps it true via
// a low-frequency liveness probe and pushes `exam-chrome-state` on every
// transition. The app quits → the spawned Chrome is killed; the app finds an
// orphaned exam Chrome at startup → it adopts it (mode resumes).

const EXAM_WATCH_INTERVAL_MS = 3000
/**
 * Consecutive liveness misses before declaring the browser closed (flakiness
 * guard). A miss is a failed probe OR a lost identity check — if a foreign
 * browser takes over the port, browser mode exits just the same.
 */
const EXAM_WATCH_MISSES = 2

let spawnedExamChrome: ChildProcess | null = null
let examWatchTimer: NodeJS.Timeout | null = null
let examWatchMisses = 0

function broadcastExamChromeState(running: boolean, port: number | null): void {
  emitToRenderer('exam-chrome-state', { running, port })
}

function stopExamChromeWatch(): void {
  if (examWatchTimer) {
    clearInterval(examWatchTimer)
    examWatchTimer = null
  }
  examWatchMisses = 0
}

function startExamChromeWatch(port: number): void {
  stopExamChromeWatch()
  examWatchTimer = setInterval(async () => {
    const alive = (await probeVersion(port, 1200)) !== null && (await examChromeOwnsPort(port))
    if (alive) {
      examWatchMisses = 0
      return
    }
    examWatchMisses += 1
    if (examWatchMisses < EXAM_WATCH_MISSES) return
    stopExamChromeWatch()
    spawnedExamChrome = null
    broadcastExamChromeState(false, null)
    emitToRenderer('ui-notify', tMain('chrome.examClosed'))
  }, EXAM_WATCH_INTERVAL_MS)
}

/** Adopt an exam Chrome left running by a previous app session (or reuse). */
export async function adoptRunningExamChrome(): Promise<void> {
  const port = await findRunningDebugChrome()
  if (port) {
    startExamChromeWatch(port)
    broadcastExamChromeState(true, port)
  } else {
    broadcastExamChromeState(false, null)
  }
}

/**
 * App is quitting → close the dedicated exam Chrome (SIGTERM to our child,
 * plus a profile-flag match for instances adopted from an older session).
 */
export function shutdownExamChrome(): void {
  stopExamChromeWatch()
  if (spawnedExamChrome && spawnedExamChrome.pid) {
    try {
      spawnedExamChrome.kill('SIGTERM')
    } catch {
      // already gone
    }
  }
  spawnedExamChrome = null
  try {
    const profile = profileDir()
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/FI', `COMMANDLINE eq *${profile}*`], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    } else {
      spawn('pkill', ['-f', `--user-data-dir=${profile}`], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    }
  } catch {
    // best-effort only
  }
}

/**
 * Launch the dedicated exam-Chrome (or reuse a running one) and wait for its
 * debugging endpoint to answer.
 */
export async function launchDebugChrome(): Promise<{
  ok: boolean
  port?: number
  error?: string
}> {
  const existing = await findRunningDebugChrome()
  if (existing) {
    startExamChromeWatch(existing)
    broadcastExamChromeState(true, existing)
    return { ok: true, port: existing }
  }

  const binary = findChromeBinary()
  if (!binary) return { ok: false, error: tMain('chrome.notFound') }

  const port = await pickFreePort(PORT_RANGE_START, PORT_RANGE_END)
  if (port === null) {
    return { ok: false, error: tMain('chrome.launchFailed', { message: 'no free debug port' }) }
  }

  try {
    const child = spawn(
      binary,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir()}`,
        '--no-first-run',
        '--no-default-browser-check'
      ],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
    child.on('error', () => {
      // Surfaced by the readiness poll below timing out
    })
    spawnedExamChrome = child
  } catch (error) {
    const message = toErrorMessage(error, String(error))
    return { ok: false, error: tMain('chrome.launchFailed', { message }) }
  }

  const deadline = Date.now() + LAUNCH_TIMEOUT_MS
  while (Date.now() < deadline) {
    const version: CdpVersion | null = await probeVersion(port)
    if (version) {
      persistPort(port)
      startExamChromeWatch(port)
      broadcastExamChromeState(true, port)
      return { ok: true, port }
    }
    await delay(READY_POLL_MS)
  }
  return { ok: false, error: tMain('chrome.connectTimeout') }
}

// --- capture -------------------------------------------------------------------

/**
 * Capture the full page of the most recently active tab as ONE image for the
 * vision model: Chrome's native captureBeyondViewport render, encoded within
 * the full-page budget (long edge ≤8000px, ≤8MP, ≤1.6MB base64) — no slicing,
 * no stitching.
 */
export async function captureFullPage(): Promise<ChromeFullPageCapture> {
  const port = await findRunningDebugChrome()
  if (!port) throw new Error(tMain('chrome.notRunning'))

  const targets = await listTargets(port)
  // /json/list order is not a reliable focus signal with several tabs open —
  // probe the first few candidates for visibility + focus and prefer those.
  const target = await pickActiveTarget(targets)
  if (!target) throw new Error(tMain('chrome.noPage'))

  let pngBase64: string
  try {
    pngBase64 = await cdpCaptureFullPage(target.webSocketDebuggerUrl, CAPTURE_TIMEOUT_MS)
  } catch (error) {
    const message = toErrorMessage(error, String(error))
    throw new Error(tMain('chrome.captureFailed', { message }))
  }

  const image = nativeImage.createFromBuffer(Buffer.from(pngBase64, 'base64'))
  if (image.isEmpty()) {
    throw new Error(tMain('chrome.captureFailed', { message: 'empty capture' }))
  }

  return { image: encodeImageWithinBudget(image, FULL_PAGE_BUDGET) }
}

ipcMain.handle('get-chrome-fullpage-status', () => getChromeFullPageStatus())

ipcMain.handle('launch-debug-chrome', () => launchDebugChrome())
