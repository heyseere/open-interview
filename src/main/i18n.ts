/**
 * Main-process user-facing strings.
 *
 * The renderer owns the full UI dictionary (lib/i18n); the main process only
 * needs the handful of strings it surfaces itself: dialogs, error messages
 * and setup progress lines. The renderer pushes the UI language through
 * `updateAppSettings`, so translations apply without any extra IPC.
 * `settings.ts` pushes the language in (setMainLanguage) to keep this module
 * dependency-free.
 */

let language: MainLanguage = 'zh-CN'

export function setMainLanguage(next: MainLanguage): void {
  language = next === 'en' ? 'en' : 'zh-CN'
}

const zhCN = {
  // Generic
  'err.unknown': '未知错误',

  // Streaming / conversation actions
  'err.notReady': '应用尚未就绪',
  'err.emptyTranscript': '没有可发送的语音转录内容',
  'err.generateFailed': '生成回答失败或已停止',
  'err.nothingToRetry': '没有可重试的请求',
  'err.retryFailed': '重试失败或已停止',
  'err.noConversation': '当前没有可追问的对话',
  'err.unknownAction': '不支持的操作',
  'err.actionFailed': '操作执行失败',

  // Transcription engine
  'err.chunkRange': '分段时长必须在 3 到 15 秒之间',
  'err.alreadyRunning': '语音转录正在进行中',
  'err.transcribeFailed': '语音转写失败',
  'label.localModel': '本地模型',

  // whisper.cpp
  'err.noCli': '未检测到识别引擎，请在设置中运行一键配置',
  'err.noModel': '本地语音模型未下载，请在设置中运行一键配置',
  'err.transcribeTimeout': '本地语音识别超时',
  'err.spawnFailed': '无法启动 {command}：{message}',
  'err.commandExit': '{command} 退出（代码 {code}）',
  'setup.prepareEngine': '正在准备识别引擎...',
  'setup.prepareModel': '正在准备模型（仅首次下载）...',
  'setup.stillMissing': '识别引擎安装后仍不可用，请重试',
  'setup.downloadEngine': '正在下载识别引擎预编译包（{tag}）...',
  'setup.extracting': '正在解压安装...',
  'setup.noCliInArchive': '压缩包中未找到识别引擎，请重试或手动安装',
  'setup.brewInstalling': '正在通过 Homebrew 安装 whisper-cpp（首次较慢）...',
  'setup.brewRequired':
    'macOS 需要识别引擎：请先安装 Homebrew（https://brew.sh）后重试，或运行 brew install whisper-cpp',
  'setup.building': '正在克隆并编译 whisper.cpp（{tag}，首次较慢）...',
  'setup.buildNoCli': '编译完成但未找到识别引擎，请重试或运行 brew install whisper-cpp',
  'setup.downloadModel': '正在下载模型（仅首次）...',
  'setup.modelDownloadFailed': '模型下载失败，请检查网络后重试',
  'setup.downloadProgress': '已下载 {received} MB / {total} MB（{percent}%）',
  'setup.downloadProgressNoTotal': '已下载 {received} MB',
  'download.failed': '下载失败（HTTP {status}）',

  // Model list
  'err.apiUrlInvalid': 'API 地址格式不正确',
  'err.apiUrlProtocol': 'API 地址必须使用 HTTP 或 HTTPS 协议',
  'err.apiUrlEmpty': '请先填写 API Base URL',
  'err.modelListHttp': '模型列表请求失败（HTTP {status}）',
  'err.modelListInvalid': '模型列表响应格式无效',
  'err.modelListTimeout': '获取模型列表超时，请检查 API 地址',

  // Dialogs
  'dialog.selectScreenshotDir': '选择截图保存目录',

  // Conversation history placeholders
  'history.imagePlaceholder': '[截图]',
  'history.blankTitle': '空白会话',

  // Auto-updater (Windows)
  'update.availableTitle': '发现新版本',
  'update.availableMessage': '检测到新版本可用。',
  'update.availableDetail': '现在下载并安装更新吗？',
  'update.downloadNow': '立即下载',
  'update.later': '稍后',
  'update.readyTitle': '更新已就绪',
  'update.readyMessage': '更新已下载完成。',
  'update.readyDetail': '是否立即重启以应用更新？',
  'update.restartNow': '立即重启'
} as const

export type MainMessageKey = keyof typeof zhCN
export type MainLanguage = 'zh-CN' | 'en'

const en: Record<MainMessageKey, string> = {
  // Generic
  'err.unknown': 'Unknown error',

  // Streaming / conversation actions
  'err.notReady': 'The app is not ready yet',
  'err.emptyTranscript': 'No transcript to send',
  'err.generateFailed': 'Generation failed or was stopped',
  'err.nothingToRetry': 'Nothing to retry',
  'err.retryFailed': 'Retry failed or was stopped',
  'err.noConversation': 'No active conversation to follow up',
  'err.unknownAction': 'Unsupported action',
  'err.actionFailed': 'Action failed',

  // Transcription engine
  'err.chunkRange': 'Chunk duration must be between 3 and 15 seconds',
  'err.alreadyRunning': 'Transcription is already running',
  'err.transcribeFailed': 'Speech transcription failed',
  'label.localModel': 'Local model',

  // whisper.cpp
  'err.noCli': 'Recognition engine not found — run one-click setup in Settings',
  'err.noModel': 'Local speech model not downloaded — run one-click setup in Settings',
  'err.transcribeTimeout': 'Local recognition timed out',
  'err.spawnFailed': 'Failed to start {command}: {message}',
  'err.commandExit': '{command} exited (code {code})',
  'setup.prepareEngine': 'Preparing the recognition engine...',
  'setup.prepareModel': 'Preparing the model (first download only)...',
  'setup.stillMissing': 'Engine is still unavailable after install — retry',
  'setup.downloadEngine': 'Downloading the prebuilt engine package ({tag})...',
  'setup.extracting': 'Extracting...',
  'setup.noCliInArchive': 'Engine not found in the archive — retry or install it manually',
  'setup.brewInstalling': 'Installing whisper-cpp via Homebrew (slow on first run)...',
  'setup.brewRequired':
    'macOS needs the engine: install Homebrew (https://brew.sh) first and retry, or run brew install whisper-cpp',
  'setup.building': 'Cloning and building whisper.cpp ({tag}; slow on first run)...',
  'setup.buildNoCli':
    'Build finished but the engine was not found — retry or run brew install whisper-cpp',
  'setup.downloadModel': 'Downloading the model (first run only)...',
  'setup.modelDownloadFailed': 'Model download failed — check the network and retry',
  'setup.downloadProgress': 'Downloaded {received} MB / {total} MB ({percent}%)',
  'setup.downloadProgressNoTotal': 'Downloaded {received} MB',
  'download.failed': 'Download failed (HTTP {status})',

  // Model list
  'err.apiUrlInvalid': 'Invalid API URL',
  'err.apiUrlProtocol': 'The API URL must use HTTP or HTTPS',
  'err.apiUrlEmpty': 'Fill in the API Base URL first',
  'err.modelListHttp': 'Model list request failed (HTTP {status})',
  'err.modelListInvalid': 'Invalid model list response',
  'err.modelListTimeout': 'Fetching the model list timed out — check the API URL',

  // Dialogs
  'dialog.selectScreenshotDir': 'Choose screenshot save folder',

  // Conversation history placeholders
  'history.imagePlaceholder': '[screenshot]',
  'history.blankTitle': 'Blank conversation',

  // Auto-updater (Windows)
  'update.availableTitle': 'Update available',
  'update.availableMessage': 'A new version is available.',
  'update.availableDetail': 'Download and install it now?',
  'update.downloadNow': 'Download now',
  'update.later': 'Later',
  'update.readyTitle': 'Update ready',
  'update.readyMessage': 'The update has been downloaded.',
  'update.readyDetail': 'Restart now to apply the update?',
  'update.restartNow': 'Restart now'
}

const dictionaries: Record<MainLanguage, Record<MainMessageKey, string>> = {
  'zh-CN': zhCN,
  en
}

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

/** Resolve a main-process string for the synced UI language (falls back to zh-CN). */
export function tMain(key: MainMessageKey, params?: Record<string, string | number>): string {
  return format(dictionaries[language][key] ?? zhCN[key], params)
}
