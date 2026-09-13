import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  access,
  chmod,
  constants,
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'
import { pcm16MonoToWav } from './audio-wav'
import { tMain } from './i18n'
import { toSimplifiedChinese } from './t2s'

/**
 * Local ASR through the whisper.cpp CLI (`whisper-cli` + ggml models).
 *
 * - The binary is acquired at setup time: a prebuilt archive from the
 *   whisper.cpp GitHub release (Windows) or Homebrew / a guarded source
 *   build on macOS, stored under userData/whisper/bin.
 * - Models are ggml files downloaded from HuggingFace (hf-mirror fallback)
 *   into userData/models.
 * - There is no daemon: every chunk spawns one short-lived `whisper-cli`
 *   process whose stdout is the transcript (per-chunk model load is the
 *   accepted trade-off; a warm whisper-server can replace this later).
 *
 * Setup is a cancellable single-flight job with streamed stage progress
 * (`engine` → `model`) over `local-asr-setup-progress`, mirroring the
 * semantics of the previous uv-based flow: liveness is judged by output
 * activity (idle timeout), never a hard total timeout.
 */

export const WHISPER_CPP_TAG = 'v1.9.2'
const GITHUB_ASSET_BASE = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_CPP_TAG}`
const MODEL_URL_BASES = [
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main',
  'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main'
]

export const LOCAL_ASR_SIZES = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3',
  'large-v3-turbo'
] as const
export type LocalAsrModelSize = (typeof LOCAL_ASR_SIZES)[number]

export const LOCAL_ASR_LANGUAGES = ['auto', 'zh', 'en'] as const
export type LocalAsrLanguage = (typeof LOCAL_ASR_LANGUAGES)[number]

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
  cliSource: 'downloaded' | 'path' | null
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
}

const EXTRA_REQUEST_TIMEOUT_MS = 120_000
/** Kill a setup child only after this much silence (never a hard total cap:
 * model downloads and source builds legitimately run for many minutes). */
const SETUP_IDLE_TIMEOUT_MS = 90_000

const CLI_NAME = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'

function whisperBinDir(): string {
  return join(app.getPath('userData'), 'whisper', 'bin')
}

function downloadedCliPath(): string {
  return join(whisperBinDir(), CLI_NAME)
}

export function modelFilePath(modelSize: LocalAsrModelSize): string {
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

/** Locate a working `whisper-cli` (downloaded copy first, then PATH/prefixes). */
export async function findWhisperCli(): Promise<{
  path: string
  source: 'downloaded' | 'path'
} | null> {
  const downloaded = downloadedCliPath()
  if (await isExecutable(downloaded)) return { path: downloaded, source: 'downloaded' }

  const dirs = [
    ...(process.env.PATH?.split(delimiter) ?? []),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(process.env.HOME ?? '', '.local', 'bin')
  ].filter(Boolean)
  for (const dir of dirs) {
    const candidate = join(dir, CLI_NAME)
    if (await isExecutable(candidate)) return { path: candidate, source: 'path' }
  }
  return null
}

async function findBrew(): Promise<string | null> {
  if (process.platform !== 'darwin') return null
  const dirs = [
    ...(process.env.PATH?.split(delimiter) ?? []),
    '/opt/homebrew/bin',
    '/usr/local/bin'
  ].filter(Boolean)
  for (const dir of dirs) {
    const candidate = join(dir, 'brew')
    if (await isExecutable(candidate)) return candidate
  }
  return null
}

/** Probe `command --version`; resolves with true when it exits 0. */
function toolAvailable(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ['--version'], { timeout: 10_000 }, (error) => resolve(!error))
  })
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

/** Active per-chunk cli children so quit can reap them. */
const activeChildren = new Set<ChildProcess>()

/**
 * Transcribe one 16kHz mono PCM chunk; resolves with plain text.
 * One whisper-cli process per chunk: stdout with `-nt -np` is exactly the
 * recognized text. Output is normalized to Simplified Chinese afterwards
 * (see t2s.ts) because zh models mix Traditional characters into their output.
 */
export async function transcribeWithWhisperCpp(
  modelSize: LocalAsrModelSize,
  language: LocalAsrLanguage,
  pcm: Buffer
): Promise<string> {
  const cli = await findWhisperCli()
  if (!cli) throw new Error(tMain('err.noCli'))

  const modelPath = modelFilePath(modelSize)
  try {
    await access(modelPath)
  } catch {
    throw new Error(tMain('err.noModel'))
  }

  const wavPath = join(tmpdir(), `icn-wcpp-${Date.now()}-${randomUUID()}.wav`)
  await writeFile(wavPath, pcm16MonoToWav(pcm))

  const args = ['-m', modelPath, '-f', wavPath, '-l', language, '-nt', '-np']
  if (language === 'zh') {
    // Initial prompt that biases decoding toward Mandarin with Simplified
    // script and mainland phrasing (well-established whisper.cpp trick)
    args.push('--prompt', '以下是普通话的句子。')
  }

  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(cli.path, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      activeChildren.add(child)

      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error(tMain('err.transcribeTimeout')))
      }, EXTRA_REQUEST_TIMEOUT_MS)

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8')
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8')
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(
          new Error(tMain('err.spawnFailed', { command: 'whisper-cli', message: error.message }))
        )
      })
      child.on('exit', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve(toSimplifiedChinese(stdout.trim()))
        } else {
          const tail = stderr.trim().split('\n').slice(-3).join('\n')
          reject(
            new Error(
              tail || tMain('err.commandExit', { command: 'whisper-cli', code: code ?? 'signal' })
            )
          )
        }
      })
      child.on('close', () => activeChildren.delete(child))
    })
  } finally {
    await rm(wavPath, { force: true }).catch(() => undefined)
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Fast environment snapshot for the settings page. Never installs anything. */
export async function localAsrStatus(modelSize: LocalAsrModelSize): Promise<LocalAsrStatus> {
  const cachedModels: LocalAsrModelSize[] = []
  for (const size of LOCAL_ASR_SIZES) {
    try {
      await access(modelFilePath(size))
      cachedModels.push(size)
    } catch {
      // not cached
    }
  }
  const cli = await findWhisperCli()
  return {
    cli: cli ? 'found' : 'missing',
    cliSource: cli?.source ?? null,
    cachedModels,
    modelCached: cachedModels.includes(modelSize),
    setupRunning: setupJob !== null
  }
}

// ---------------------------------------------------------------------------
// Setup job (single-flight, cancellable, streamed progress)
// ---------------------------------------------------------------------------

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
 * `onLine`. Fails on output silence (SETUP_IDLE_TIMEOUT_MS) instead of a
 * hard total timeout — downloads and builds must never be killed mid-flight.
 */
function runStreamed(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  onLine: (line: string) => void
): StreamedChild {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let idleTimer: NodeJS.Timeout | null = null
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => child.kill(), SETUP_IDLE_TIMEOUT_MS)
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
  registerAbort: (controller: AbortController) => void
): Promise<void> {
  const controller = new AbortController()
  registerAbort(controller)

  const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
  if (!response.ok || !response.body) {
    throw new Error(tMain('download.failed', { status: response.status }))
  }

  const total = Number(response.headers.get('content-length') || 0)
  const partPath = `${destPath}.part`
  let received = 0
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
      createWriteStream(partPath)
    )
    await rename(partPath, destPath)
  } catch (error) {
    await rm(partPath, { force: true }).catch(() => undefined)
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
 * copy `whisper-cli` plus its runtime DLLs into the managed bin dir.
 */
async function installPrebuiltCli(
  archivePath: string,
  extractArgs: string[],
  extractDir: string,
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void
): Promise<void> {
  const extract = runStreamed('tar', [...extractArgs, archivePath, '-C', extractDir], {}, onLine)
  registerChild(extract.child)
  await extract.promise

  const cliSource = await findFileRecursive(extractDir, CLI_NAME)
  if (!cliSource) throw new Error(tMain('setup.noCliInArchive'))

  await mkdir(whisperBinDir(), { recursive: true })
  await copyFile(cliSource, downloadedCliPath())
  if (process.platform !== 'win32') {
    await chmod(downloadedCliPath(), 0o755).catch(() => undefined)
  }

  // Windows builds keep whisper.dll/ggml*.dll next to the executable
  if (process.platform === 'win32') {
    const siblings = await readdir(join(cliSource, '..'))
    for (const name of siblings) {
      if (name.endsWith('.dll')) {
        await copyFile(join(cliSource, '..', name), join(whisperBinDir(), name)).catch(
          () => undefined
        )
      }
    }
  }
}

async function setupEngineOnWindows(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void,
  registerAbort: (controller: AbortController) => void
): Promise<void> {
  onLine(tMain('setup.downloadEngine', { tag: WHISPER_CPP_TAG }))
  const workDir = join(tmpdir(), `icn-wcpp-${randomUUID()}`)
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
    await installPrebuiltCli(archivePath, ['-xf'], join(workDir, 'extract'), onLine, registerChild)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function setupEngineOnMac(
  onLine: (line: string) => void,
  registerChild: (child: ChildProcess) => void
): Promise<void> {
  const brew = await findBrew()
  if (brew) {
    onLine(tMain('setup.brewInstalling'))
    const install = runStreamed(
      brew,
      ['install', 'whisper-cpp'],
      { env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1' } },
      onLine
    )
    registerChild(install.child)
    await install.promise
    return
  }

  // No brew: fall back to a source build when the toolchain is already there
  const gitOk = await toolAvailable('git')
  const cmakeOk = await toolAvailable('cmake')
  const clangOk = await toolAvailable('clang')
  if (!gitOk || !cmakeOk || !clangOk) {
    throw new Error(tMain('setup.brewRequired'))
  }

  onLine(tMain('setup.building', { tag: WHISPER_CPP_TAG }))
  const workDir = join(tmpdir(), `icn-wcpp-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  try {
    const clone = runStreamed(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        WHISPER_CPP_TAG,
        'https://github.com/ggml-org/whisper.cpp',
        'src'
      ],
      { cwd: workDir },
      onLine
    )
    registerChild(clone.child)
    await clone.promise

    const sourceDir = join(workDir, 'src')
    const configure = runStreamed(
      'cmake',
      ['-B', 'build', '-DCMAKE_BUILD_TYPE=Release'],
      { cwd: sourceDir },
      onLine
    )
    registerChild(configure.child)
    await configure.promise

    const build = runStreamed('cmake', ['--build', 'build', '-j'], { cwd: sourceDir }, onLine)
    registerChild(build.child)
    await build.promise

    const builtCli = join(sourceDir, 'build', 'bin', CLI_NAME)
    try {
      await access(builtCli)
    } catch {
      throw new Error(tMain('setup.buildNoCli'))
    }
    await mkdir(whisperBinDir(), { recursive: true })
    await copyFile(builtCli, downloadedCliPath())
    await chmod(downloadedCliPath(), 0o755).catch(() => undefined)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

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

  await mkdir(join(destPath, '..'), { recursive: true })
  let lastError: unknown = null
  for (const base of MODEL_URL_BASES) {
    try {
      onLine(tMain('setup.downloadModel'))
      await downloadFile(`${base}/ggml-${modelSize}.bin`, destPath, onLine, registerAbort)
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
    const emitProgress = (progress: LocalAsrSetupProgress) => {
      const mainWindow = global.mainWindow
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('local-asr-setup-progress', progress)
      }
    }

    try {
      // Stage 1: engine (whisper-cli)
      try {
        if (job.cancelled) {
          return { ok: false, stage: 'engine', installed: false, cacheModels: [], cancelled: true }
        }
        const existing = await findWhisperCli()
        if (!existing) {
          emitProgress({
            stage: 'engine',
            status: 'start',
            message: tMain('setup.prepareEngine')
          })
          if (process.platform === 'win32') {
            await setupEngineOnWindows(
              (line) => emitProgress({ stage: 'engine', status: 'progress', message: line }),
              (child) => {
                job.child = child
              },
              (controller) => {
                job.abort = controller
              }
            )
          } else {
            await setupEngineOnMac(
              (line) => emitProgress({ stage: 'engine', status: 'progress', message: line }),
              (child) => {
                job.child = child
              }
            )
          }
          if (job.cancelled) {
            return {
              ok: false,
              stage: 'engine',
              installed: false,
              cacheModels: [],
              cancelled: true
            }
          }
          if (!(await findWhisperCli())) {
            throw new Error(tMain('setup.stillMissing'))
          }
        }
        emitProgress({ stage: 'engine', status: 'ok' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        emitProgress({ stage: 'engine', status: 'error', message })
        return {
          ok: false,
          stage: 'engine',
          installed: false,
          cacheModels: [],
          message,
          cancelled: job.cancelled
        }
      }

      // Stage 2: model (ggml file)
      try {
        if (job.cancelled) {
          return { ok: false, stage: 'model', installed: true, cacheModels: [], cancelled: true }
        }
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
        if (job.cancelled) {
          return { ok: false, stage: 'model', installed: true, cacheModels: [], cancelled: true }
        }
        emitProgress({ stage: 'model', status: 'ok' })
        emitProgress({ stage: 'done', status: 'ok' })
        return { ok: true, stage: 'model', installed: true, cacheModels: [modelSize] }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        emitProgress({ stage: 'model', status: 'error', message })
        return {
          ok: false,
          stage: 'model',
          installed: true,
          cacheModels: [],
          message,
          cancelled: job.cancelled
        }
      }
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

/** Release every local ASR resource (app quit). */
export function disposeWhisperCpp(): void {
  cancelLocalAsrSetup()
  for (const child of activeChildren) child.kill()
  activeChildren.clear()
}
