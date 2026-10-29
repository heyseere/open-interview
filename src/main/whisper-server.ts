import { spawn, type ChildProcess } from 'node:child_process'
import {
  access,
  chmod,
  constants,
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  statfs
} from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { cpus, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import { pcm16MonoToWav } from './audio-wav'
import { pickFreePort } from './free-port'
import { tMain } from './i18n'
import { toSimplifiedChinese } from './t2s'
import {
  parseTranscriptionResponse,
  type TranscriptionWindowResult
} from './transcription-response'
import { emitToRenderer, toErrorMessage } from './renderer-send'
import {
  LOCAL_ASR_LANGUAGES,
  LOCAL_ASR_SIZES,
  type LocalAsrLanguage,
  type LocalAsrModelSize
} from '../shared/asr'

/**
 * Local ASR through `whisper-server` (whisper.cpp's HTTP server).
 *
 * Why a server instead of `whisper-cli` per chunk: the CLI reloads the model
 * (hundreds of MB) on every invocation, which put a multi-second floor under
 * each transcription and made sliding-window streaming impossible. One warm
 * server keeps the model resident and answers `/inference` in well under a
 * second for short windows (measured: 1.2 s for a 6.8 s clip on M2/Metal).
 *
 * Lifecycle:
 * - The process is started lazily on the first transcription and reused for
 *   as long as the model stays the same. Switching model restarts it.
 * - It exits by itself after IDLE_SHUTDOWN_MS of inactivity so the app does
 *   not sit on a few hundred MB of model memory while idle.
 * - A crash is restarted once per transcription window; a second failure
 *   surfaces as a normal transcription error.
 *
 * The engine binary is NOT bundled: it is installed on first use through the
 * platform's package manager (Homebrew's `whisper.cpp` on macOS, winget on
 * Windows with the official prebuilt zip as a fallback). Resolution order is
 * package manager → userData (zip fallback) → PATH, so an engine the user
 * already installed by hand is used as-is and nothing is downloaded twice.
 */

const WHISPER_CPP_TAG = 'v1.9.2'
const GITHUB_ASSET_BASE = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_CPP_TAG}`
const MODEL_URL_BASES = [
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main',
  'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main'
]
/** Homebrew formula names, newest first (the formula was renamed in 2026). */
const BREW_FORMULAE = ['whisper.cpp', 'whisper-cpp']
/** winget package ids probed before falling back to the release zip. */
const WINGET_IDS = ['ggml.whisper.cpp', 'ggerganov.whisper.cpp', 'whisper.cpp']

export { LOCAL_ASR_LANGUAGES, LOCAL_ASR_SIZES }
export type { LocalAsrLanguage, LocalAsrModelSize }

/** Where the engine binary came from (surfaced in Settings). */
export type LocalAsrEngineSource = 'brew' | 'winget' | 'downloaded' | 'path'

export interface LocalAsrSetupResult {
  ok: boolean
  stage: 'engine' | 'model'
  installed: boolean
  cacheModels: LocalAsrModelSize[]
  message?: string
  cancelled?: boolean
}

export interface LocalAsrStatus {
  cli: 'found' | 'missing'
  cliSource: LocalAsrEngineSource | null
  cachedModels: LocalAsrModelSize[]
  /** Whether the requested model size is present on disk. */
  modelCached: boolean
  setupRunning: boolean
}

export type LocalAsrSetupStage = 'engine' | 'model' | 'done'

export interface LocalAsrSetupProgress {
  stage: LocalAsrSetupStage
  status: 'start' | 'progress' | 'ok' | 'error'
  message?: string
  /**
   * Machine-readable failure class for the settings UI (e.g. render a
   * "open brew.sh" button on `brew-missing`). Absent for unclassified errors.
   */
  code?: 'brew-missing'
}

/** Kill a setup child only after this much silence (never a hard total cap:
 * model downloads and package-manager installs legitimately run for many
 * minutes). */
const SETUP_IDLE_TIMEOUT_MS = 90_000
/** Package managers spend a long time resolving/building before printing
 * anything, so they get a wider silence window than a plain download. */
const PACKAGE_MANAGER_IDLE_TIMEOUT_MS = 180_000
/** Upper bound for one `/inference` round trip. A warm server answers a 20 s
 * window in ~1-2 s; anything near this cap means the process is wedged. */
const INFERENCE_TIMEOUT_MS = 60_000
/** Stop the resident server after this long without a request. */
const IDLE_SHUTDOWN_MS = 3 * 60_000
const HEALTH_POLL_MS = 120
const STARTUP_TIMEOUT_MS = 90_000

const SERVER_NAME = process.platform === 'win32' ? 'whisper-server.exe' : 'whisper-server'

function whisperBinDir(): string {
  return join(app.getPath('userData'), 'whisper', 'bin')
}

function downloadedServerPath(): string {
  return join(whisperBinDir(), SERVER_NAME)
}

function modelFilePath(modelSize: LocalAsrModelSize): string {
  return join(app.getPath('userData'), 'models', `ggml-${modelSize}.bin`)
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Directories a package manager installs `whisper-server` into. */
function packageManagerDirs(): { dir: string; source: LocalAsrEngineSource }[] {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    return localAppData
      ? [{ dir: join(localAppData, 'Microsoft', 'WinGet', 'Links'), source: 'winget' }]
      : []
  }
  if (process.platform === 'darwin') {
    // Apple Silicon, Intel, and the version-independent opt prefix the brew
    // formula links into (it keeps the binary reachable across upgrades).
    const prefixBins = ['/opt/homebrew/bin', '/usr/local/bin'].map((dir) => ({
      dir,
      source: 'brew' as const
    }))
    return [
      ...prefixBins,
      ...BREW_FORMULAE.map((formula) => ({
        dir: `/opt/homebrew/opt/${formula}/bin`,
        source: 'brew' as const
      })),
      ...BREW_FORMULAE.map((formula) => ({
        dir: `/usr/local/opt/${formula}/bin`,
        source: 'brew' as const
      }))
    ]
  }
  return []
}

/** Locate a working `whisper-server`: package manager → userData → PATH. */
async function findWhisperServer(): Promise<{
  path: string
  source: LocalAsrEngineSource
} | null> {
  for (const { dir, source } of packageManagerDirs()) {
    const candidate = join(dir, SERVER_NAME)
    if (await isExecutable(candidate)) return { path: candidate, source }
  }

  const downloaded = downloadedServerPath()
  if (await isExecutable(downloaded)) return { path: downloaded, source: 'downloaded' }

  const dirs = [
    ...(process.env.PATH?.split(delimiter) ?? []),
    join(process.env.HOME ?? '', '.local', 'bin')
  ].filter(Boolean)
  for (const dir of dirs) {
    const candidate = join(dir, SERVER_NAME)
    if (await isExecutable(candidate)) return { path: candidate, source: 'path' }
  }
  return null
}

/** Absolute path to Homebrew, or null. GUI apps get a minimal PATH, so the
 * two standard prefixes are probed directly instead of relying on `which`. */
async function findBrew(): Promise<string | null> {
  for (const candidate of ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']) {
    if (await isExecutable(candidate)) return candidate
  }
  for (const dir of process.env.PATH?.split(delimiter) ?? []) {
    const candidate = join(dir, 'brew')
    if (await isExecutable(candidate)) return candidate
  }
  return null
}

/** Localized name of an engine source, for setup progress lines. */
function engineSourceLabel(source: LocalAsrEngineSource): string {
  const keys = {
    brew: 'label.engineBrew',
    winget: 'label.engineWinget',
    downloaded: 'label.engineDownloaded',
    path: 'label.enginePath'
  } as const
  return tMain(keys[source])
}

// ---------------------------------------------------------------------------
// Resident server
// ---------------------------------------------------------------------------

interface ServerHandle {
  child: ChildProcess
  port: number
  modelSize: LocalAsrModelSize
}

let handle: ServerHandle | null = null
/** A spawned child still inside its health-check window (no handle yet) —
 * must be killed on quit too, or it outlives the app with the model loaded. */
let pendingChild: ChildProcess | null = null
let starting: Promise<ServerHandle> | null = null
let idleTimer: NodeJS.Timeout | null = null
let exitRequested = false

function clearIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
}

/** Stop the resident server after a quiet period (memory, not correctness). */
function armIdleTimer(): void {
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    idleTimer = null
    void stopServer()
  }, IDLE_SHUTDOWN_MS)
}

function stopServer(): Promise<void> {
  clearIdleTimer()
  const target: ChildProcess | null = handle?.child ?? pendingChild
  handle = null
  pendingChild = null
  if (!target) return Promise.resolve()
  return new Promise((resolve) => {
    exitRequested = true
    target.once('exit', () => resolve())
    target.kill()
    // A wedged process must not keep the app alive on quit.
    setTimeout(() => {
      target.kill('SIGKILL')
      resolve()
    }, 3000)
  })
}

async function healthOk(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(tMain('err.serverExited'))
    }
    if (await healthOk(port)) return
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS))
  }
  throw new Error(tMain('err.serverTimeout'))
}

/**
 * Start the server for `modelSize`, or reuse the running one. Concurrent
 * callers share a single startup promise.
 */
async function ensureServer(modelSize: LocalAsrModelSize): Promise<ServerHandle> {
  if (handle && handle.modelSize === modelSize && handle.child.exitCode === null) {
    armIdleTimer()
    return handle
  }
  if (starting) {
    const pending = await starting
    if (pending.modelSize === modelSize) {
      armIdleTimer()
      return pending
    }
    await stopServer()
  }

  starting = (async () => {
    const server = await findWhisperServer()
    if (!server) throw new Error(tMain('err.noCli'))

    const modelPath = modelFilePath(modelSize)
    try {
      await access(modelPath)
    } catch {
      throw new Error(tMain('err.noModel'))
    }

    const port = await pickFreePort(39_100, 39_999)
    if (port === null) throw new Error(tMain('err.noPort'))

    exitRequested = false
    const child = spawn(
      server.path,
      [
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '-m',
        modelPath,
        '-t',
        String(Math.max(2, Math.min(8, cpus().length - 1)))
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    pendingChild = child

    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf-8')}`.slice(-4000)
    })
    child.stdout?.resume()

    child.on('exit', (code) => {
      if (handle?.child === child) handle = null
      if (pendingChild === child) pendingChild = null
      if (!exitRequested && code !== 0) {
        console.error(`[asr] whisper-server exited with ${code}: ${stderr.slice(-600)}`)
      }
    })

    try {
      await waitForHealth(port, child)
    } catch (error) {
      child.kill()
      pendingChild = null
      throw error
    }

    const created: ServerHandle = { child, port, modelSize }
    handle = created
    pendingChild = null
    armIdleTimer()
    return created
  })()

  try {
    return await starting
  } finally {
    starting = null
  }
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

/** Per-window abort controllers so a cancel interrupts the HTTP call. */
const activeControllers = new Set<AbortController>()

export interface TranscribeWindowOptions {
  language: LocalAsrLanguage
  /** Initial prompt carrying the tail of already-committed text. */
  prompt?: string
  signal?: AbortSignal
}

/**
 * Transcribe one PCM window (16 kHz mono PCM16) and return its text plus
 * segment timings. Throws on transport/engine failure; aborting via `signal`
 * rejects with an AbortError.
 */
export async function transcribeWindow(
  modelSize: LocalAsrModelSize,
  pcm: Buffer,
  options: TranscribeWindowOptions
): Promise<TranscriptionWindowResult> {
  const server = await ensureServer(modelSize)
  armIdleTimer()

  const controller = new AbortController()
  activeControllers.add(controller)
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

  try {
    // The WAV stays in memory: the PCM buffer is already contiguous, so a
    // temp-file round trip per 700ms tick only added write+read+unlink work.
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(pcm16MonoToWav(pcm))], { type: 'audio/wav' }),
      'audio.wav'
    )
    form.append('language', options.language)
    form.append('response_format', 'verbose_json')
    form.append('temperature', '0.0')
    if (options.prompt) form.append('prompt', options.prompt)

    const response = await fetch(`http://127.0.0.1:${server.port}/inference`, {
      method: 'POST',
      body: form,
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(tMain('err.transcribeFailed'))
    }
    const parsed = parseTranscriptionResponse(await response.json())
    return {
      text: toSimplifiedChinese(parsed.text),
      segments: parsed.segments.map((segment) => ({
        ...segment,
        text: toSimplifiedChinese(segment.text)
      }))
    }
  } catch (error) {
    if (controller.signal.aborted && options.signal?.aborted) {
      throw new DOMException('aborted', 'AbortError')
    }
    // The INFERENCE_TIMEOUT_MS timer fires the same controller: report the
    // localized timeout instead of a raw English AbortError.
    if (controller.signal.aborted) {
      throw new Error(tMain('err.transcribeTimeout'))
    }
    throw error
  } finally {
    clearTimeout(timeout)
    activeControllers.delete(controller)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Fast environment snapshot for the settings page. Never installs anything. */
export async function localAsrStatus(modelSize: LocalAsrModelSize): Promise<LocalAsrStatus> {
  const [cached, server] = await Promise.all([
    Promise.all(
      LOCAL_ASR_SIZES.map(async (size) => {
        try {
          await access(modelFilePath(size))
          return size
        } catch {
          return null
        }
      })
    ),
    findWhisperServer()
  ])
  const cachedModels = cached.filter((size): size is LocalAsrModelSize => size !== null)
  return {
    cli: server ? 'found' : 'missing',
    cliSource: server?.source ?? null,
    cachedModels,
    modelCached: cachedModels.includes(modelSize),
    setupRunning: setupJob !== null
  }
}

// ---------------------------------------------------------------------------
// Setup job (single-flight, cancellable, streamed progress)
// ---------------------------------------------------------------------------

/**
 * Setup failure with a machine-readable class, so the settings UI can render
 * a matching repair affordance (e.g. an "open brew.sh" button) instead of
 * string-matching localized messages.
 */
export class SetupStageError extends Error {
  readonly code: NonNullable<LocalAsrSetupProgress['code']>
  constructor(message: string, code: NonNullable<LocalAsrSetupProgress['code']>) {
    super(message)
    this.code = code
  }
}

interface SetupJob {
  modelSize: LocalAsrModelSize
  cancelled: boolean
  child: ChildProcess | null
  abort: AbortController | null
  promise: Promise<LocalAsrSetupResult>
}

let setupJob: SetupJob | null = null

interface StreamedChild {
  promise: Promise<void>
  child: ChildProcess
}

/**
 * Spawn a long-running setup step whose stderr/stdout lines stream into
 * `onLine`. Fails on output silence instead of a hard total timeout —
 * downloads and package installs must never be killed mid-flight.
 * `idleTimeoutMs` is widened for package managers, which resolve and link for
 * a long time before printing anything.
 */
function runStreamed(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; idleTimeoutMs?: number },
  onLine: (line: string) => void
): StreamedChild {
  const idleTimeoutMs = options.idleTimeoutMs ?? SETUP_IDLE_TIMEOUT_MS
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let idleTimer: NodeJS.Timeout | null = null
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => child.kill(), idleTimeoutMs)
  }
  resetIdle()

  const promise = new Promise<void>((resolve, reject) => {
    const handle = (chunk: Buffer) => {
      resetIdle()
      for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed) onLine(trimmed)
      }
    }
    child.stdout?.on('data', handle)
    child.stderr?.on('data', handle)
    child.on('error', (error) => {
      if (idleTimer) clearTimeout(idleTimer)
      reject(new Error(tMain('err.spawnFailed', { command, message: error.message })))
    })
    child.on('exit', (code) => {
      if (idleTimer) clearTimeout(idleTimer)
      if (code === 0) resolve()
      else reject(new Error(tMain('err.commandExit', { command, code: code ?? 'signal' })))
    })
  })

  return { promise, child }
}

async function downloadFile(
  url: string,
  destPath: string,
  onLine: (line: string) => void,
  registerAbort: (controller: AbortController) => void,
  /** Keep a failed `.part` and resume it with a Range request on the next try. */
  options: { resume?: boolean } = {}
): Promise<void> {
  const controller = new AbortController()
  registerAbort(controller)
  const partPath = `${destPath}.part`

  /**
   * Bytes already in `.part` (resume mode) — a failed multi-hundred-MB model
   * download restarts from where it stopped instead of from zero. Only model
   * downloads opt in: the engine archive lives in a throwaway temp dir where
   * a leftover part has no second chance anyway.
   */
  const partSize = async (): Promise<number> => {
    if (!options.resume) return 0
    try {
      return (await stat(partPath)).size
    } catch {
      return 0
    }
  }

  // Header-phase timeout: the stall watchdog below only sees body bytes, so
  // a server that accepts the connection but never responds would otherwise
  // hang this fetch forever (the idle timer is armed only after it returns).
  const headerController = new AbortController()
  const headerTimer = setTimeout(() => headerController.abort(), SETUP_IDLE_TIMEOUT_MS)
  let response: Response
  let resumeFrom: number
  try {
    resumeFrom = await partSize()
    response = await fetch(url, {
      redirect: 'follow',
      headers: resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : undefined,
      signal: AbortSignal.any([controller.signal, headerController.signal])
    })
    if (resumeFrom > 0 && response.status === 416) {
      // The stale part no longer matches the remote file (replaced upstream):
      // drop it and fetch from zero.
      await rm(partPath, { force: true }).catch(() => undefined)
      resumeFrom = 0
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.any([controller.signal, headerController.signal])
      })
    }
  } finally {
    clearTimeout(headerTimer)
  }
  if (!response.ok || !response.body) {
    throw new Error(tMain('download.failed', { status: response.status }))
  }
  // A 200 answer to a Range request means the server ignored it: start over.
  if (resumeFrom > 0 && response.status !== 206) resumeFrom = 0

  // On 206 the content-length covers only the remaining bytes.
  const total = Number(response.headers.get('content-length') || 0) + resumeFrom
  let received = resumeFrom
  let lastReport = 0
  // Abort when the body stalls without any bytes for the idle timeout
  const stallTimer = setInterval(() => {
    if (Date.now() - lastReport > SETUP_IDLE_TIMEOUT_MS) controller.abort()
  }, 10_000)

  try {
    await pipeline(
      Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
      async function* (source) {
        for await (const chunk of source) {
          received += chunk.length
          lastReport = Date.now()
          if (total > 0) {
            const mb = (received / 1024 / 1024).toFixed(1)
            const totalMb = (total / 1024 / 1024).toFixed(1)
            const percent = Math.round((received / total) * 100)
            onLine(tMain('setup.downloadProgress', { received: mb, total: totalMb, percent }))
          } else {
            onLine(
              tMain('setup.downloadProgressNoTotal', {
                received: (received / 1024 / 1024).toFixed(1)
              })
            )
          }
          yield chunk
        }
      },
      createWriteStream(partPath, { flags: resumeFrom > 0 ? 'a' : 'w' })
    )
    await rename(partPath, destPath)
  } catch (error) {
    if (!options.resume) await rm(partPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    clearInterval(stallTimer)
  }
}

/** Recursively locate a file name under a directory (small archives only). */
async function findFileRecursive(dir: string, name: string): Promise<string | null> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = await findFileRecursive(full, name)
      if (hit) return hit
    } else if (entry.name === name) {
      return full
    }
  }
  return null
}

/**
 * Extract the prebuilt whisper.cpp archive (Windows zip) into `dest`, then
 * copy `whisper-server` (plus the CLI when present) and the runtime DLLs into
 * the managed bin dir.
 */
async function installPrebuiltServer(
  archivePath: string,
  extractArgs: string[],
  extractDir: string,
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void
): Promise<void> {
  const extract = runStreamed('tar', [...extractArgs, archivePath, '-C', extractDir], {}, onLine)
  registerChild(extract.child)
  await extract.promise

  const serverSource = await findFileRecursive(extractDir, SERVER_NAME)
  if (!serverSource) throw new Error(tMain('setup.noCliInArchive'))

  await mkdir(whisperBinDir(), { recursive: true })
  await copyFile(serverSource, downloadedServerPath())
  if (process.platform !== 'win32') {
    await chmod(downloadedServerPath(), 0o755).catch(() => undefined)
  }

  // Windows builds keep whisper.dll/ggml*.dll next to the executable
  if (process.platform === 'win32') {
    const siblings = await readdir(join(serverSource, '..'))
    for (const name of siblings) {
      if (name.endsWith('.dll')) {
        await copyFile(join(serverSource, '..', name), join(whisperBinDir(), name)).catch(
          () => undefined
        )
      }
    }
  }
}

/**
 * Install the engine with Homebrew (macOS). `brew install whisper.cpp` ships
 * `whisper-server` alongside the CLI, so no local toolchain is needed — the
 * formula is a bottle on both Apple Silicon and Intel.
 */
async function setupEngineWithBrew(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void
): Promise<void> {
  const brew = await findBrew()
  if (!brew) throw new SetupStageError(tMain('setup.brewMissing'), 'brew-missing')

  onLine(tMain('setup.installWithBrew'))
  // Non-interactive: brew must never block on a prompt (there is no terminal
  // behind a GUI app) and must not run a full `brew update` first, which can
  // take minutes on a cold cache.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NONINTERACTIVE: '1',
    HOMEBREW_NO_AUTO_UPDATE: '1',
    HOMEBREW_NO_INSTALL_CLEANUP: '1',
    HOMEBREW_NO_ENV_HINTS: '1'
  }

  let lastError: unknown = null
  for (const formula of BREW_FORMULAE) {
    const step = runStreamed(
      brew,
      ['install', formula],
      { env, idleTimeoutMs: PACKAGE_MANAGER_IDLE_TIMEOUT_MS },
      onLine
    )
    registerChild(step.child)
    try {
      await step.promise
      if (await findWhisperServer()) return
      lastError = new Error(tMain('setup.stillMissing'))
    } catch (error) {
      // The renamed formula fails fast on an older brew that still only knows
      // the old name, so try the next name instead of surfacing the error.
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(tMain('setup.brewFailed'))
}

/**
 * Install the engine with winget (Windows), then fall back to the official
 * prebuilt release zip. winget-pkgs does not carry whisper.cpp today, so the
 * fallback is the path that actually runs — the probe keeps the primary path
 * working for users whose winget has a community package.
 */
async function setupEngineWithWinget(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void,
  registerAbort: (controller: AbortController) => void
): Promise<void> {
  const installed = await tryWingetInstall(onLine, registerChild)
  if (installed && (await findWhisperServer())) return

  if (installed === false) onLine(tMain('setup.wingetUnavailable'))
  await setupEngineOnWindows(onLine, registerChild, registerAbort)
}

/** `true` = a package installed, `false` = no winget/package found. */
async function tryWingetInstall(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void
): Promise<boolean> {
  onLine(tMain('setup.installWithWinget'))
  for (const id of WINGET_IDS) {
    const probe = runStreamed(
      'winget',
      ['show', '--exact', '--id', id, '--accept-source-agreements'],
      { idleTimeoutMs: PACKAGE_MANAGER_IDLE_TIMEOUT_MS },
      () => undefined
    )
    registerChild(probe.child)
    try {
      await probe.promise
    } catch {
      // `winget show` exits non-zero when the id does not exist — keep probing.
      continue
    }

    onLine(tMain('setup.wingetInstalling', { id }))
    const install = runStreamed(
      'winget',
      [
        'install',
        '--exact',
        '--id',
        id,
        '--silent',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity'
      ],
      { idleTimeoutMs: PACKAGE_MANAGER_IDLE_TIMEOUT_MS },
      onLine
    )
    registerChild(install.child)
    try {
      await install.promise
      return true
    } catch {
      return false
    }
  }
  return false
}

async function setupEngineOnWindows(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void,
  registerAbort: (controller: AbortController) => void
): Promise<void> {
  onLine(tMain('setup.downloadEngine', { tag: WHISPER_CPP_TAG }))
  const workDir = join(tmpdir(), `icn-wcpp-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  try {
    const archivePath = join(workDir, 'whisper-bin-x64.zip')
    await downloadFile(
      `${GITHUB_ASSET_BASE}/whisper-bin-x64.zip`,
      archivePath,
      onLine,
      registerAbort
    )
    onLine(tMain('setup.extracting'))
    await installPrebuiltServer(
      archivePath,
      ['-xf'],
      join(workDir, 'extract'),
      onLine,
      registerChild
    )
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Free space required before a model download starts (models are ~150MB–3GB). */
const MODEL_MIN_FREE_BYTES = 1024 ** 3

async function downloadModel(
  modelSize: LocalAsrModelSize,
  onLine: (line: string) => void,
  registerAbort: (controller: AbortController) => void
): Promise<void> {
  const destPath = modelFilePath(modelSize)
  try {
    await access(destPath)
    return
  } catch {
    // needs download
  }

  // Fail before spending minutes on a download that cannot land: statfs is
  // unavailable on some platforms, in which case the check silently skips.
  let freeBytes = -1
  try {
    const stats = await statfs(join(destPath, '..'))
    freeBytes = stats.bavail * stats.bsize
  } catch {
    // unsupported — skip
  }
  if (freeBytes >= 0 && freeBytes < MODEL_MIN_FREE_BYTES) {
    throw new Error(tMain('setup.diskFull'))
  }

  await mkdir(join(destPath, '..'), { recursive: true })
  let lastError: unknown = null
  for (const base of MODEL_URL_BASES) {
    try {
      onLine(tMain('setup.downloadModel'))
      await downloadFile(`${base}/ggml-${modelSize}.bin`, destPath, onLine, registerAbort, {
        resume: true
      })
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(tMain('setup.modelDownloadFailed'))
}

/**
 * Start (or join) the one-click setup job. Progress is streamed via
 * `local-asr-setup-progress`; concurrent invocations attach to the job.
 */
export function setupLocalAsr(modelSize: LocalAsrModelSize): Promise<LocalAsrSetupResult> {
  if (setupJob) return setupJob.promise

  const job: SetupJob = {
    modelSize,
    cancelled: false,
    child: null,
    abort: null,
    promise: null as never
  }
  setupJob = job
  job.promise = (async (): Promise<LocalAsrSetupResult> => {
    const emitProgress = (progress: LocalAsrSetupProgress) =>
      emitToRenderer('local-asr-setup-progress', progress)

    /**
     * Run one setup stage with uniform cancellation and failure semantics.
     * `installed` describes whether the engine stage already succeeded before
     * this stage starts (model install implies engine present).
     */
    const runStage = async (
      stage: 'engine' | 'model',
      installed: boolean,
      work: () => Promise<void>
    ): Promise<LocalAsrSetupResult | null> => {
      const cancelled = (): LocalAsrSetupResult => ({
        ok: false,
        stage,
        installed,
        cacheModels: [],
        cancelled: true
      })
      if (job.cancelled) return cancelled()
      try {
        await work()
        if (job.cancelled) return cancelled()
        return null
      } catch (error) {
        const message = toErrorMessage(error, String(error))
        emitProgress({
          stage,
          status: 'error',
          message,
          code: error instanceof SetupStageError ? error.code : undefined
        })
        return {
          ok: false,
          stage,
          installed,
          cacheModels: [],
          message,
          cancelled: job.cancelled
        }
      }
    }

    try {
      // Stage 1: engine (whisper-server), installed through the platform's
      // package manager — macOS: Homebrew; Windows: winget, then the official
      // prebuilt zip when winget has no package for it.
      const engineFailure = await runStage('engine', false, async () => {
        const existing = await findWhisperServer()
        if (!existing) {
          emitProgress({
            stage: 'engine',
            status: 'start',
            message: tMain('setup.prepareEngine')
          })
          const onLine = (line: string) =>
            emitProgress({ stage: 'engine', status: 'progress', message: line })
          const registerChild = (child: ChildProcess) => {
            job.child = child
          }
          if (process.platform === 'win32') {
            await setupEngineWithWinget(onLine, registerChild, (controller) => {
              job.abort = controller
            })
          } else {
            await setupEngineWithBrew(onLine, registerChild)
          }
          if (!(await findWhisperServer())) {
            throw new Error(tMain('setup.stillMissing'))
          }
        } else {
          emitProgress({
            stage: 'engine',
            status: 'start',
            message: tMain('setup.engineReady', { source: engineSourceLabel(existing.source) })
          })
        }
        emitProgress({ stage: 'engine', status: 'ok' })
      })
      if (engineFailure) return engineFailure

      // Stage 2: model (ggml file)
      const modelFailure = await runStage('model', true, async () => {
        emitProgress({
          stage: 'model',
          status: 'start',
          message: tMain('setup.prepareModel')
        })
        await downloadModel(
          modelSize,
          (line) => {
            emitProgress({ stage: 'model', status: 'progress', message: line })
          },
          (controller) => {
            job.abort = controller
          }
        )
        emitProgress({ stage: 'model', status: 'ok' })
        emitProgress({ stage: 'done', status: 'ok' })
      })
      if (modelFailure) return modelFailure
      return { ok: true, stage: 'model', installed: true, cacheModels: [modelSize] }
    } finally {
      setupJob = null
    }
  })()

  return job.promise
}

/** Cancel the running setup job, if any. */
export function cancelLocalAsrSetup(): void {
  if (!setupJob) return
  setupJob.cancelled = true
  setupJob.child?.kill()
  setupJob.abort?.abort()
}

/** Abort every in-flight `/inference` request (cancel / app quit). */
function abortActiveTranscriptions(): void {
  for (const controller of activeControllers) controller.abort()
  activeControllers.clear()
}

/** Release every local ASR resource (app quit). */
export function disposeWhisperServer(): void {
  cancelLocalAsrSetup()
  abortActiveTranscriptions()
  void stopServer()
}
