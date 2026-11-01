/**
 * Single source of truth for every user-facing string.
 *
 * Each key carries BOTH locales on one line: adding a string is a single
 * edit and a missing translation is a compile error, instead of the old
 * two parallel files (zh-CN.ts + en.ts, 400 lines each) that had to be
 * kept in sync by hand.
 */
export const messages = {
  // Generic
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.submit': { zh: '提交', en: 'Submit' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.back': { zh: '返回', en: 'Back' },
  'common.retry': { zh: '重试', en: 'Retry' },
  'common.loading': { zh: '加载中…', en: 'Loading…' },
  'common.seconds': { zh: '{n} 秒', en: '{n}s' },

  // Error-row repair actions (kind-aware, see StatusBar ErrorRow)
  'errAction.openPermissions': { zh: '打开权限中心', en: 'Open Permission Center' },
  'errAction.openSettings': { zh: '打开设置', en: 'Open Settings' },

  // Right-edge page scroller: end jumps + page steps
  'scroll.top': { zh: '回到顶部', en: 'Jump to top' },
  'scroll.up': { zh: '向上翻页（悬停持续滚动）', en: 'Page up (hover to keep scrolling)' },
  'scroll.down': { zh: '向下翻页（悬停持续滚动）', en: 'Page down (hover to keep scrolling)' },
  'scroll.bottom': { zh: '滑到底部', en: 'Jump to bottom' },

  // Coder page
  'coder.pressShortcut': { zh: '请按下快捷键', en: 'Press a shortcut' },
  'coder.shortcutGroupAi': { zh: '截图与语音', en: 'Capture & voice' },
  'coder.shortcutGroupWindow': { zh: '窗口', en: 'Window' },
  'coder.screenshotAlt': { zh: 'Screenshot {n}', en: 'Screenshot {n}' },
  'coder.screenshotTitle': { zh: '第 {n} 张截图', en: 'Screenshot {n}' },
  'coder.copyCode': { zh: '复制代码', en: 'Copy code' },
  'coder.copied': { zh: '已复制', en: 'Copied' },
  'coder.copyFailed': { zh: '复制失败', en: 'Copy failed' },

  // Status bar
  'status.generating': { zh: '正在生成回答…', en: 'Generating the answer…' },
  'status.followUpPlaceholder': {
    zh: '输入追问内容…',
    en: 'Type your follow-up…'
  },
  'status.followUpFailed': {
    zh: '发送失败，请检查网络与 API 配置',
    en: 'Send failed — retry or check network and API settings'
  },

  // Header feature buttons
  'header.privacyOn': {
    zh: '隐私模式已开启：对屏幕共享/录屏不可见，截图不写入磁盘',
    en: 'Privacy mode on: invisible to screen sharing and recording; screenshots are not saved to disk'
  },
  'header.privacyOff': {
    zh: '隐私模式已关闭：窗口对屏幕共享可见',
    en: 'Privacy mode off: the window is visible to screen sharing'
  },
  'header.passThroughOff': {
    zh: '开启鼠标穿透（穿透后可用快捷键或工具栏恢复）',
    en: 'Enable mouse passthrough (restore via shortcut or the toolbar)'
  },
  'header.passThroughOn': {
    zh: '鼠标穿透中：点击会穿透到下层窗口，用快捷键或工具栏恢复',
    en: 'Passthrough on — clicks fall through to the window below; restore via shortcut or toolbar'
  },
  'header.settings': { zh: '设置', en: 'Settings' },
  'header.close': { zh: '关闭窗口', en: 'Close window' },
  'header.toggleCompact': { zh: '紧凑模式', en: 'Compact mode' },
  'header.sceneSwitcher': { zh: '切换使用场景', en: 'Switch scene' },
  'header.examChromeStopped': {
    zh: '启动笔试 Chrome（用于网页整页截图）',
    en: 'Start exam Chrome (for full-page captures)'
  },
  'header.examChromeRunning': {
    zh: '笔试 Chrome 运行中 · 端口 {port}',
    en: 'Exam Chrome running · port {port}'
  },
  'header.examChromeLaunching': { zh: '正在启动笔试 Chrome…', en: 'Starting exam Chrome…' },

  // Status bar (transcription row)
  'transcription.waitingForSpeech': {
    zh: '正在听，请开始说话…',
    en: 'Listening — start speaking…'
  },

  // Compact ticker
  'compact.waiting': { zh: '等待生成…', en: 'Waiting for generation…' },
  'compact.exitStandard': { zh: '返回标准模式', en: 'Back to standard layout' },
  // History dialog
  'history.title': { zh: '会话历史', en: 'Conversation history' },
  'history.empty': { zh: '暂无历史会话', en: 'No conversations yet' },
  'history.emptyHint': {
    zh: '完成第一次截图后，对话会自动保存在这里',
    en: 'Conversations are saved here after your first capture'
  },
  'history.turnCount': { zh: '{n} 轮对话', en: '{n} turns' },
  'history.selectHint': {
    zh: '在左侧选择一段会话查看内容',
    en: 'Pick a conversation on the left to read it'
  },
  'history.textOnlyNote': {
    zh: '仅保留文字内容，不含截图',
    en: 'Text only — screenshots are not stored'
  },
  'history.deleteConfirmText': {
    zh: '确定删除这条会话记录吗？此操作无法恢复。',
    en: 'Delete this conversation record? This action cannot be undone.'
  },
  'history.loadFailed': { zh: '加载会话失败', en: 'Failed to load conversation' },

  // Transcription errors (coder page)
  'transcriptionError.sendFailed': {
    zh: '发送识别文字失败',
    en: 'Failed to send the recognized text'
  },
  'transcriptionError.stopFailed': {
    zh: '停止语音识别失败',
    en: 'Failed to stop speech recognition'
  },
  'transcriptionError.startFailed': {
    zh: '启动语音识别失败：请先完成一键配置，并检查系统权限',
    en: 'Failed to start speech recognition — run one-click setup and check system permissions'
  },
  'transcriptionError.mediaPermissionDenied': {
    zh: '麦克风/屏幕录制权限被拒绝，请在 系统设置 → 隐私与安全性 中允许本应用',
    en: 'Microphone / screen-recording permission denied — allow this app in System Settings → Privacy & Security'
  },

  // Permissions page
  'permission.title': { zh: '权限设置', en: 'Permissions' },
  'permission.entry': { zh: '系统权限', en: 'System permissions' },
  'permission.entryHint': {
    zh: '截图与语音识别所需的屏幕录制、麦克风权限',
    en: 'Screen recording and microphone access for screenshots and speech recognition'
  },
  'permission.openCenter': { zh: '权限中心', en: 'Permission center' },
  'permission.screenTitle': { zh: '屏幕录制', en: 'Screen recording' },
  'permission.screenDesc': {
    zh: '截取屏幕题目，并采集系统声音用于语音识别',
    en: 'Captures the screen for questions and system audio for speech recognition'
  },
  'permission.micTitle': { zh: '麦克风', en: 'Microphone' },
  'permission.micDesc': {
    zh: '以麦克风作为语音识别的输入设备',
    en: 'Use a microphone as the speech-recognition input device'
  },
  'permission.requestAction': { zh: '请求权限', en: 'Request' },
  'permission.openSettings': { zh: '打开系统设置', en: 'Open System Settings' },
  'permission.statusGranted': { zh: '已授权', en: 'Granted' },
  'permission.statusDenied': { zh: '已拒绝', en: 'Denied' },
  'permission.statusNotDetermined': { zh: '待授权', en: 'Not requested' },
  'permission.statusRestricted': { zh: '受限', en: 'Restricted' },
  'permission.statusUnknown': { zh: '未知', en: 'Unknown' },
  'permission.devNote': {
    zh: '开发模式下权限弹窗会归属给启动它的终端，应用不会真正弹窗；请用打包后的应用测试权限流程',
    en: 'In dev mode macOS attributes permission prompts to the spawning terminal — test the permission flow with a packaged build'
  },
  'permission.grantedNote': {
    zh: '当前系统无需单独授权',
    en: 'No separate permission is required on this system'
  },
  'permission.deniedNote': {
    zh: '权限被拒绝后系统不再弹窗，请在 系统设置 → 隐私与安全性 中手动允许',
    en: 'A denied permission never re-prompts — allow this app manually in System Settings → Privacy & Security'
  },

  // Local transcription (settings)
  'settings.localModelLabel': { zh: '模型规模', en: 'Model size' },
  'settings.localModelHint': {
    zh: '边说边识别，无需分段。识别引擎由 Homebrew / winget 安装，模型首次一键下载，之后完全离线可用',
    en: 'Recognizes as you speak — no segments to tune. The engine comes from Homebrew / winget and the model downloads once; fully offline afterwards'
  },
  'settings.localSetupAction': { zh: '一键配置', en: 'Set up' },
  'settings.localSetupDone': { zh: '环境就绪', en: 'Ready' },
  'settings.localSetupFailed': { zh: '配置失败', en: 'Setup failed' },
  'settings.localSetupCancel': { zh: '取消配置', en: 'Cancel' },
  'settings.localSetupCancelled': { zh: '配置已取消', en: 'Setup cancelled' },
  'settings.localSetupStageEngine': {
    zh: '正在安装识别引擎（首次较慢）',
    en: 'Installing the recognition engine (slow on first run)'
  },
  'settings.localSetupStageModel': {
    zh: '正在下载/校验模型（仅首次）',
    en: 'Downloading/verifying model (first run only)'
  },
  'settings.localStatusCli': { zh: '语音识别引擎', en: 'Speech recognition engine' },
  'settings.localStatusCliMissing': {
    zh: '未安装，点击一键配置自动准备',
    en: 'Not installed — run one-click setup'
  },
  'settings.localStatusCliBrew': { zh: 'Homebrew 安装', en: 'Installed via Homebrew' },
  'settings.localStatusCliWinget': { zh: 'winget 安装', en: 'Installed via winget' },
  'settings.localStatusCliDownloaded': { zh: '已下载', en: 'Downloaded' },
  'settings.localStatusCliPath': { zh: '系统 PATH', en: 'System PATH' },
  'settings.localStatusModel': { zh: '模型', en: 'Model' },
  'settings.localStatusOk': { zh: '就绪', en: 'Ready' },
  'settings.localStatusCachedOthers': { zh: '已缓存', en: 'Cached' },
  'settings.localModelNeedsDownload': {
    zh: '未下载，配置时将下载该模型',
    en: 'Not downloaded — setup will fetch this model'
  },
  'settings.openBrewSite': { zh: '打开 brew.sh', en: 'Open brew.sh' },
  // Readiness card at the top of Settings
  'settings.readinessTitle': { zh: '就绪状态', en: 'Readiness' },
  'settings.readinessProvider': { zh: '模型服务', en: 'Model provider' },
  'settings.readinessProviderMissing': {
    zh: '未配置，在下方“模型服务”填写 API 地址并选择模型',
    en: 'Not configured — fill in the API URL and model in the provider card below'
  },
  'settings.readinessAsr': { zh: '语音识别', en: 'Speech recognition' },
  'settings.readinessPermissions': { zh: '系统权限', en: 'System permissions' },
  'settings.readinessPermissionsMissing': {
    zh: '麦克风或屏幕录制尚未授权',
    en: 'Microphone or screen recording not granted yet'
  },
  'settings.localLanguageLabel': { zh: '识别语言', en: 'Recognition language' },
  'settings.localLanguageHint': {
    zh: '识别哪种语言，可选自动检测',
    en: 'Which language to recognize; auto detects it'
  },
  'settings.localLanguageAuto': { zh: '自动检测', en: 'Auto-detect' },
  'settings.localLanguageZh': { zh: '简体中文', en: 'Simplified Chinese' },
  'settings.localLanguageEn': { zh: 'English', en: 'English' },
  'settings.localVerifyAction': { zh: '试录 3 秒', en: 'Test 3s' },
  'settings.localVerifyHint': {
    zh: '录制 3 秒并直接返回识别结果，不会发送给 AI',
    en: 'Record 3 seconds and show the raw transcript (never sent to the AI)'
  },
  'settings.localVerifyResult': { zh: '识别结果', en: 'Result' },
  'settings.localVerifyNoSpeech': {
    zh: '未识别到语音，请检查输入设备或再试一次',
    en: 'No speech detected — check the input device and try again'
  },
  'settings.localVerifySilent': {
    zh: '试录期间没有采集到声音：请确认系统正在播放音频，或更换输入设备',
    en: 'No audio was captured — make sure something is playing, or switch to another input device'
  },
  'settings.localVerifyDone': { zh: '本地识别验证成功', en: 'Local recognition verified' },

  // Settings page
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.aiSection': { zh: 'AI 设置', en: 'AI Settings' },
  'settings.providerLabel': { zh: '模型提供商', en: 'Provider' },
  'settings.providerHint': {
    zh: '不同提供商各自保存地址、密钥与模型',
    en: 'Each provider keeps its own URL, key and model'
  },
  'settings.providerPlaceholder': { zh: '选择提供商', en: 'Choose a provider' },
  'settings.providerAdd': { zh: '添加提供商', en: 'Add provider' },
  'settings.providerAddDescription': {
    zh: '选择预设，或自定义一个 OpenAI 兼容端点',
    en: 'Pick a preset, or add a custom OpenAI-compatible endpoint'
  },
  'settings.providerRemove': { zh: '删除当前提供商', en: 'Remove this provider' },
  'settings.providerCustom': { zh: '自定义', en: 'Custom' },
  'settings.providerCustomHint': {
    zh: '手动填写任意 OpenAI 兼容地址',
    en: 'Any OpenAI-compatible endpoint'
  },
  'settings.baseUrlLabel': { zh: 'API Base URL', en: 'API Base URL' },
  'settings.baseUrlHint': {
    zh: '如硅基流动为 https://api.siliconflow.cn/v1',
    en: 'SiliconFlow example: https://api.siliconflow.cn/v1'
  },
  'settings.baseUrlPlaceholder': {
    zh: '如 https://api.openai.com/v1',
    en: 'e.g. https://api.openai.com/v1'
  },
  'settings.apiKeyLabel': { zh: 'API Key', en: 'API Key' },
  'settings.apiKeyHint': {
    zh: '加密保存在本机；本地服务可不填',
    en: 'Encrypted on this device; optional for local servers'
  },
  'settings.apiKeyShow': { zh: '显示密钥', en: 'Show key' },
  'settings.apiKeyHide': { zh: '隐藏密钥', en: 'Hide key' },
  'settings.modelLabel': { zh: '模型', en: 'Model' },
  'settings.apiKeyPlaceholder': { zh: '输入 API Key', en: 'Enter API Key' },
  'settings.modelHint': {
    zh: '下拉可直接搜索，或用「获取模型列表」从 API 获取',
    en: 'Search in the dropdown, or fetch the list from the API'
  },
  'settings.testConnectionLabel': { zh: '测试连接', en: 'Test connection' },
  'settings.testConnectionHint': {
    zh: '填好上方配置后点击，立即验证连通性',
    en: 'Click after filling in the config above to verify it works'
  },
  'settings.testConnectionAction': { zh: '测试', en: 'Test' },
  'settings.testConnectionOk': { zh: '连接正常', en: 'Connection OK' },
  'settings.testConnectionFail': { zh: '连接失败：{error}', en: 'Connection failed: {error}' },
  'settings.transcriptionSection': { zh: '语音识别', en: 'Speech Recognition' },
  'settings.vadSilenceLabel': { zh: '停顿多久自动发送', en: 'Pause before auto-send' },
  'settings.vadSilenceHint': {
    zh: '开启「说完自动发送」时，安静超过该时长即自动发送识别文字',
    en: 'With the toolbar auto-send toggle on, this much silence triggers the send'
  },
  'settings.inputDeviceLabel': { zh: '音频输入设备', en: 'Audio input device' },
  'settings.inputDeviceHint': {
    zh: '默认用系统正在播放的声音，也可改用麦克风',
    en: 'System audio (default) captures what your computer plays — or pick a microphone'
  },
  'settings.refreshDevicesHint': {
    zh: '读取设备名称（需要麦克风权限）',
    en: 'Read device names (requires microphone access)'
  },
  'settings.inputDevicePlaceholder': { zh: '请选择输入设备', en: 'Select input device' },
  'settings.systemAudio': { zh: '系统音频', en: 'System audio' },
  'settings.solverSection': { zh: '解题设置', en: 'Solver Settings' },
  'settings.sceneLabel': { zh: '使用场景', en: 'Scenes' },
  'settings.sceneHint': {
    zh: '切换立即生效，提示词改动需保存',
    en: 'Switching applies instantly; prompt edits need saving'
  },
  'settings.renameScene': { zh: '重命名该场景', en: 'Rename scene' },
  'settings.deleteScene': { zh: '删除该场景', en: 'Delete scene' },
  'settings.promptLabel': { zh: '系统提示词', en: 'System prompt' },
  'settings.promptSceneSuffix': { zh: '场景', en: 'scene' },
  'settings.resetPrompt': {
    zh: '将默认提示词填回编辑框，保存后生效',
    en: 'Puts the default prompt back in the editor — save to apply'
  },
  'settings.resetPromptAction': { zh: '恢复默认', en: 'Reset default' },
  'settings.promptRevert': { zh: '撤销', en: 'Revert' },
  'settings.promptSaved': { zh: '提示词已保存', en: 'Prompt saved' },
  'settings.promptUnsaved': { zh: '有未保存的修改', en: 'Unsaved changes' },
  'settings.promptPlaceholder': {
    zh: '示例：你是一个解题助手，请根据截图和语音内容给出回答。',
    en: 'e.g.: You are a problem-solving assistant. Answer based on the screenshot and speech.'
  },
  'settings.addSceneTitle': { zh: '新增场景', en: 'Add scene' },
  'settings.addSceneDescription': {
    zh: '创建后可为该场景编写专属的系统提示词',
    en: 'Give the new scene its own system prompt after creating it'
  },
  'settings.sceneNamePlaceholder': {
    zh: '场景名称，如：数学考试',
    en: 'Scene name, e.g.: Math exam'
  },
  'settings.create': { zh: '创建', en: 'Create' },
  'settings.deleteSceneTitle': { zh: '删除场景', en: 'Delete scene' },
  'settings.deleteSceneDescription': {
    zh: '确定删除场景「{name}」吗？其提示词内容将一并删除，且无法恢复。',
    en: 'Delete scene "{name}"? Its prompt will be removed permanently.'
  },
  'settings.renameSceneTitle': { zh: '重命名场景', en: 'Rename scene' },
  'settings.renameSceneDescription': {
    zh: '为自定义场景设置一个新的名称，预设场景不可重命名',
    en: 'Set a new name for this custom scene. Preset scenes cannot be renamed.'
  },
  'settings.appearanceSection': { zh: '外观设置', en: 'Appearance' },
  'settings.opacityLabel': { zh: '窗口透明度', en: 'Window opacity' },
  'settings.opacityHint': { zh: '拖动可实时预览效果', en: 'Drag to preview live' },
  'settings.opacityTransparent': { zh: '透明', en: 'Transparent' },
  'settings.opacityOpaque': { zh: '不透明', en: 'Opaque' },
  'settings.languageLabel': { zh: '界面语言', en: 'Language' },
  'settings.languageHint': { zh: '切换应用界面显示语言', en: 'Switch the UI language' },
  'settings.answerFontLabel': { zh: '答案字号', en: 'Answer text size' },
  'settings.answerFontHint': {
    zh: '答案和紧凑面板的文字大小',
    en: 'Text size for answers and the compact panel'
  },
  'settings.answerFontSmall': { zh: '小', en: 'Small' },
  'settings.answerFontMedium': { zh: '标准', en: 'Medium' },
  'settings.answerFontLarge': { zh: '大', en: 'Large' },
  'settings.shortcutsSection': { zh: '快捷键设置', en: 'Shortcuts' },
  'settings.shortcutsHint': {
    zh: '快捷键在主界面（悬浮窗）生效',
    en: 'Shortcuts apply on the main floating window'
  },
  'settings.saveScreenshotsSection': { zh: '保存截图', en: 'Save Screenshots' },
  'settings.autoSaveLabel': { zh: '保存截图到本地', en: 'Save screenshots locally' },
  'settings.autoSaveHint': {
    zh: '截图自动保存到下方目录',
    en: 'Screenshots are saved to the folder below automatically'
  },
  'settings.saveDirLabel': { zh: '保存目录', en: 'Save directory' },
  'settings.saveDirHint': {
    zh: '点击右侧路径可更换',
    en: 'Click the path on the right to change it'
  },
  'settings.saveDirAction': { zh: '点击选择保存目录', en: 'Click to choose directory' },
  'settings.saveDirDefault': {
    zh: '默认: 图片/InterviewCoder',
    en: 'Default: Pictures/InterviewCoder'
  },
  'settings.renameFailed': {
    zh: '重命名失败：名称无效或与其他场景重复',
    en: 'Rename failed: invalid name or duplicate of an existing scene'
  },

  // Toasts
  'toast.compactModeEntered': {
    zh: '已进入紧凑模式，按 {key} 返回标准模式',
    en: 'Entered compact mode — press {key} to return to standard mode'
  },
  'toast.sceneSwitched': { zh: '已切换场景：{name}', en: 'Scene switched: {name}' },
  'toast.opacityChanged': { zh: '窗口不透明度 {value}%', en: 'Window opacity {value}%' },
  'toast.apiSwitched': { zh: '已切换接口，请重新选择模型', en: 'API changed — pick a model again' },
  'toast.modelsRefreshed': {
    zh: '模型列表已更新（{n} 个）',
    en: 'Model list updated ({n} models)'
  },
  'toast.examChromeStarted': {
    zh: '笔试 Chrome 已启动，浏览器模式开启',
    en: 'Exam Chrome started — browser mode on'
  },

  // Hover toolbar
  'toolbar.voice': { zh: '语音识别', en: 'Speech recognition' },
  'toolbar.autoSubmit': { zh: '说完自动发送', en: 'Auto-send when done' },
  'toolbar.submitTranscript': { zh: '发送识别出的文字', en: 'Send recognized text' },
  'toolbar.clearTranscript': { zh: '停止并丢弃', en: 'Stop & discard' },
  'toolbar.takeScreenshot': { zh: '截图并提交', en: 'Screenshot & solve' },
  'toolbar.fullPageCapture': {
    zh: '网页整页截图（需先启动笔试 Chrome）',
    en: 'Full-page capture (start exam Chrome first)'
  },
  'toolbar.appendScreenshot': { zh: '追加截图', en: 'Append screenshot' },
  'toolbar.followUp': { zh: '追问', en: 'Follow-up' },
  'toolbar.stop': { zh: '停止生成', en: 'Stop generating' },
  'toolbar.retry': { zh: '重新提交', en: 'Resubmit' },
  'toolbar.newSession': { zh: '新会话', en: 'New session' },
  'settings.toolbarButtonsLabel': { zh: '紧凑工具栏按钮', en: 'Compact toolbar buttons' },
  'settings.toolbarButtonsHint': {
    zh: '只影响紧凑面板的工具栏；标准模式恒显全部按钮',
    en: 'Applies to the compact panel toolbar only; standard mode always shows every button'
  },
  'settings.toolbarSectionTranscription': { zh: '语音', en: 'Voice' },
  'settings.toolbarSectionScreenshot': { zh: '截图', en: 'Capture' },
  'settings.toolbarSectionGeneration': { zh: '生成', en: 'Generation' },
  'settings.toolbarLabel': { zh: '悬停工具栏', en: 'Hover toolbar' },
  'settings.toolbarHint': {
    zh: '主界面底部的悬浮工具栏',
    en: 'The floating toolbar at the bottom of the main window'
  },
  'settings.hoverTriggerLabel': { zh: '悬停触发', en: 'Hover trigger' },
  'settings.hoverTriggerHint': {
    zh: '悬停停顿一下就自动执行；关闭后点一下才执行',
    en: 'Briefly hovering a button runs it; off, buttons run on click only'
  },
  'settings.dwellLabel': { zh: '悬停触发时长', en: 'Dwell duration' },
  'settings.dwellHint': {
    zh: '悬停多久后自动触发（0.2–1 秒）',
    en: 'How long to hover before a button fires (0.2–1s)'
  },
  'settings.dwellDecrease': { zh: '减少 0.1 秒', en: 'Decrease by 0.1s' },
  'settings.dwellIncrease': { zh: '增加 0.1 秒', en: 'Increase by 0.1s' },

  // SelectModel
  'model.selectPlaceholder': { zh: '选择模型…', en: 'Select model…' },
  'model.searchOrCreate': { zh: '输入以搜索或创建…', en: 'Search or create…' },
  'model.noResults': { zh: '未找到结果', en: 'No results' },
  'model.create': { zh: '创建 “{name}”', en: 'Create "{name}"' },
  'model.count': { zh: '{n} 个模型', en: '{n} models' },
  'model.staleHint': {
    zh: '来自旧接口，点击刷新',
    en: 'From the previous API — refresh to update'
  },
  'model.fetchAction': { zh: '获取模型列表', en: 'Fetch models' },
  'model.fetchTitleReady': {
    zh: '从 API 获取可用模型列表',
    en: 'Fetch available models from the API'
  },
  'model.fetchTitleBlocked': {
    zh: '请先填写上方的接口地址和密钥',
    en: 'Fill in the API base URL and key above first'
  },
  'model.needConfig': {
    zh: '请先在设置中填写接口地址和密钥',
    en: 'Fill in the API base URL and key in Settings first'
  },
  'model.fetched': { zh: '已从 API 获取 {n} 个模型', en: 'Fetched {n} models from the API' },
  'model.fetchFailed': { zh: '获取模型列表失败', en: 'Failed to fetch model list' },

  // Reasoning (deep thinking)
  'settings.reasoningLabel': { zh: '深度思考', en: 'Deep thinking' },
  'settings.reasoningHint': {
    zh: '模型会先想一步再作答，通常更准但更慢',
    en: 'The model reasons before answering — usually more accurate but slower'
  },
  'settings.reasoningUnknownHint': {
    zh: '模型未提供思考参数信息，可按需自行选择',
    en: 'The model list reports no reasoning info — choose freely'
  },
  'settings.reasoningOff': { zh: '关闭', en: 'Off' },
  'settings.reasoningLow': { zh: '低', en: 'Low' },
  'settings.reasoningMedium': { zh: '中', en: 'Medium' },
  'settings.reasoningHigh': { zh: '高', en: 'High' },

  // Full-page capture (dedicated exam Chrome)

  // Custom shortcuts
  'shortcuts.windowManagement': { zh: '窗口管理', en: 'Window Management' },
  'shortcuts.hideOrShow': { zh: '隐藏/显示窗口', en: 'Hide/show window' },
  'shortcuts.mousePassThrough': { zh: '鼠标穿透', en: 'Mouse passthrough' },
  'shortcuts.mousePassThroughDesc': {
    zh: '开启后可点击窗口背后的内容',
    en: 'Clicks pass through to the content behind the window'
  },
  'shortcuts.toggleMiniMode': { zh: '紧凑模式', en: 'Compact mode' },
  'shortcuts.opacityUp': { zh: '窗口更不透明', en: 'More opaque' },
  'shortcuts.opacityDown': { zh: '窗口更透明', en: 'More transparent' },
  'shortcuts.screenshotAndAi': { zh: '截图与AI', en: 'Screenshot & AI' },
  'shortcuts.takeScreenshot': { zh: '截图', en: 'Screenshot' },
  'shortcuts.takeScreenshotDesc': {
    zh: '截图并生成解答（新开对话）',
    en: 'Capture and solve (starts a new chat)'
  },
  'shortcuts.appendScreenshot': { zh: '追加截图', en: 'Append screenshot' },
  'shortcuts.appendScreenshotDesc': {
    zh: '在当前对话中追加截图',
    en: 'Add a screenshot to the current conversation'
  },
  'shortcuts.captureFullPage': { zh: '整页截图', en: 'Full-page capture' },
  'shortcuts.captureFullPageDesc': {
    zh: '把笔试 Chrome 当前网页完整截取并提交（新开对话）',
    en: 'Capture the exam Chrome page in full and submit it (new conversation)'
  },
  'shortcuts.stopGenerating': { zh: '停止生成', en: 'Stop generating' },
  'shortcuts.stopGeneratingDesc': {
    zh: '打断正在生成的回答',
    en: 'Interrupt the answer being generated'
  },
  'shortcuts.followUpQuestion': { zh: '追问', en: 'Follow-up' },
  'shortcuts.followUpQuestionDesc': {
    zh: '打开追问输入框，继续当前对话',
    en: 'Open the follow-up input box'
  },
  'shortcuts.toggleTranscription': { zh: '语音识别', en: 'Speech recognition' },
  'shortcuts.toggleTranscriptionDesc': {
    zh: '按一下开始听，再按一下停止并发送',
    en: 'Press once to start; press again to stop & submit'
  },
  'shortcuts.clearTranscription': { zh: '清除识别文字', en: 'Clear transcript' },
  'shortcuts.clearTranscriptionDesc': {
    zh: '清空已识别的文字（不发送）',
    en: 'Clear transcribed text (not submitted)'
  },
  'shortcuts.switchScene': { zh: '切换使用场景', en: 'Switch prompt scene' },
  'shortcuts.switchSceneDesc': {
    zh: '在多个使用场景之间循环切换',
    en: 'Cycle through the prompt scenes'
  },
  'shortcuts.navigation': { zh: '页面导航', en: 'Navigation' },
  'shortcuts.pageUp': { zh: '向上翻页', en: 'Page up' },
  'shortcuts.pageDown': { zh: '向下翻页', en: 'Page down' },
  'shortcuts.windowMovement': { zh: '窗口移动', en: 'Window Movement' },
  'shortcuts.moveUp': { zh: '向上移动窗口', en: 'Move window up' },
  'shortcuts.moveDown': { zh: '向下移动窗口', en: 'Move window down' },
  'shortcuts.moveLeft': { zh: '向左移动窗口', en: 'Move window left' },
  'shortcuts.moveRight': { zh: '向右移动窗口', en: 'Move window right' },
  'shortcuts.recording': {
    zh: '请按下快捷键（键盘组合或鼠标中键/侧键），Esc 取消',
    en: 'Press a key combo or mouse middle/side button — Esc to cancel'
  },
  'shortcuts.occupied': { zh: '快捷键被占用', en: 'Shortcut unavailable' },
  'shortcuts.occupiedHint': {
    zh: '该组合键已被其他软件或系统占用：换一个组合键，或在原软件中解除绑定',
    en: 'This combination is taken by another app or the system — pick a different one, or unbind it there first'
  },
  'shortcuts.conflict': {
    zh: '该快捷键已被其他功能占用，请先修改那条绑定',
    en: 'This key is already assigned to another action. Change that binding first.'
  },
  'shortcuts.resetSuccess': { zh: '重置默认快捷键成功', en: 'Shortcuts reset to defaults' },
  'shortcuts.resetAction': { zh: '重置默认快捷键', en: 'Reset defaults' },

  // Help page (documentation only — no interactive elements, so every key
  // here is prose; keycaps come from ActionShortcut/ShortcutRow at render time)
  'help.title': { zh: '帮助中心', en: 'Help Center' },
  'help.introTitle': { zh: '这个工具能帮你做什么', en: 'What this tool does' },
  'help.introBody': {
    zh: '遇到不会做的题，不用切窗口、不用复制粘贴：按一下快捷键，屏幕上看到的题目会截图发给 AI，答案几秒内边生成边显示在这个小窗里。适合笔试、在线测评、看论文，或者任何「看到题目想立刻要个思路」的场合。',
    en: 'Stuck on a question? No window switching, no copy-paste: press one shortcut, the question on screen is captured and sent to the AI, and the answer streams into this small window within seconds. Built for online assessments, coding tests and reading papers — anywhere you see a question and want an answer fast.'
  },
  'help.featuresTitle': { zh: '核心能力', en: 'What you get' },
  'help.featureScreenshot': {
    zh: '快捷键截图，答案边生成边显示。可以追加截图延续同一段对话，多题、长题都不用重新开始。',
    en: 'Shortcut capture with a streaming answer. Append more screenshots to keep the same conversation, so multi-question and long pages never restart.'
  },
  'help.featureTranscription': {
    zh: '语音识别：把面试官说的话、或你念出来的题目实时转成文字，全程在本机完成，录音不上传。',
    en: 'Speech recognition turns what the interviewer says — or a question you read aloud — into text in real time, entirely on this machine. Audio is never uploaded.'
  },
  'help.featureStealth': {
    zh: '隐私模式：窗口对屏幕共享和录屏不可见，截图也不写入磁盘。',
    en: 'Privacy mode keeps the window invisible to screen sharing and recording, and stops screenshots from being written to disk.'
  },
  'help.featureOverlay': {
    zh: '窗口置顶且半透明，点击它也不会抢走原页面的焦点，看完答案继续答题即可。',
    en: 'Always on top and translucent. Clicking it never steals focus from the page, so you go straight back to working.'
  },
  'help.quickStartTitle': { zh: '三步上手', en: 'Get started in three steps' },
  'help.step1Title': { zh: '1. 填好 API 配置', en: '1. Configure your model' },
  'help.step1Body': {
    zh: '在「设置 → AI 设置」里选择模型提供商（OpenAI、硅基流动、DeepSeek 等），填入 API Key 后测试连接。密钥加密保存在本机，不会进入浏览器存储。',
    en: 'Open Settings → AI Settings, pick a provider (OpenAI, SiliconFlow, DeepSeek, …), paste your API key and test the connection. Keys are stored encrypted on this device and never reach browser storage.'
  },
  'help.step2Title': { zh: '2. 对着题目按快捷键', en: '2. Press the shortcut on the question' },
  'help.step2Body': {
    zh: '把题目留在屏幕上，按下截图快捷键即可。截图会立即出现在窗口里，AI 开始作答；答案很长时窗口顶部固定不动，你随时可以自己往下翻。',
    en: 'Leave the question on screen and press the capture shortcut. The screenshot appears instantly and the AI starts answering; for long answers the view stays put so you can scroll at your own pace.'
  },
  'help.step3Title': { zh: '3. 继续追问', en: '3. Keep asking' },
  'help.step3Body': {
    zh: '答案不满意，就用追问快捷键继续输入问题。换一道题，直接再截一次图就行。历史会话随时能在顶栏的会话历史里找回。',
    en: 'Not satisfied? Use the follow-up shortcut to ask more. For a new question, just capture again — past conversations stay in the history panel in the top bar.'
  },
  'help.shortcutsTitle': { zh: '快捷键总览', en: 'All shortcuts' },
  'help.shortcutsBody': {
    zh: '快捷键是操作这个窗口的主要方式，下面是当前实际生效的绑定。窗口隐藏或鼠标穿透时，快捷键依然可用。',
    en: 'Shortcuts are the main way to drive this window. Below are the bindings currently in effect — they keep working while the window is hidden or click-through.'
  },
  'help.shortcutsEditHint': {
    zh: '以上键位都可以在「设置 → 快捷键设置」里修改，也支持鼠标侧键。',
    en: 'Every binding above can be changed in Settings → Shortcuts, mouse side buttons included.'
  },
  'help.scenesTitle': { zh: '使用场景与提示词', en: 'Scenes and prompts' },
  'help.scenesBody': {
    zh: '同一个题目，不同场景会得到不同的回答风格。顶栏的下拉框用来切换当前场景，场景切换快捷键可以按顺序轮换，切换后窗口会提示新场景的名字。',
    en: 'The same question gets a different answer style depending on the scene. The dropdown in the top bar switches it, and the scene shortcut cycles through the list in order, with a toast naming the scene you landed on.'
  },
  'help.scenesPresetsTitle': { zh: '内置场景', en: 'Built-in scenes' },
  'help.scenesPresetCoding': {
    zh: '解算法题：直接给思路与可运行的代码，少讲废话。',
    en: 'Coding problems: the approach plus runnable code, with the filler left out.'
  },
  'help.scenesPresetEnglish': {
    zh: '英语考试：按考试题型作答，给出答案与必要的解析。',
    en: 'English exams: answers in the exam format, with the reasoning that matters.'
  },
  'help.scenesPresetGeneral': {
    zh: '通用问答：日常题目、概念解释、阅读理解的默认风格。',
    en: 'General Q&A: the default style for everyday questions, concept explanations and reading comprehension.'
  },
  'help.scenesCustomTitle': { zh: '自定义场景', en: 'Custom scenes' },
  'help.scenesCustomBody': {
    zh: '在「设置 → 解题设置」里可以新建场景、改名字、写自己的提示词。提示词是草稿制的：改完要保存才生效，也可以一键恢复默认。',
    en: 'Settings → Solver Settings lets you create scenes, rename them and write your own prompt. Edits are drafts — save to apply, or restore the default in one step.'
  },
  'help.asrTitle': { zh: '语音识别', en: 'Speech recognition' },
  'help.asrBody': {
    zh: '语音识别把听到的话实时变成文字，边说边出，不需要等固定时长分段。识别引擎通过 Homebrew（macOS）或 winget（Windows）安装，模型在首次使用时下载一次，之后完全离线可用；音频不离开这台电脑。',
    en: 'Speech recognition turns what it hears into text as you speak — no waiting for fixed chunks. The engine is installed through Homebrew (macOS) or winget (Windows), and the model downloads once on first use, after which everything runs offline. Audio never leaves this machine.'
  },
  'help.asrStepsTitle': { zh: '开始之前', en: 'Before you start' },
  'help.asrStep1': {
    zh: '在「设置 → 语音识别」里点一键配置：自动安装识别引擎并下载模型。macOS 需要先装好 Homebrew；模型越大越准，也越吃内存。',
    en: 'Run the one-click setup in Settings → Speech Recognition: it installs the engine and downloads the model. macOS needs Homebrew installed first; bigger models are more accurate and use more memory.'
  },
  'help.asrStep2': {
    zh: '按',
    en: 'Press'
  },
  'help.asrStep3': {
    zh: '开始识别，文字会边识别边显示在状态栏里；再次按下同一个快捷键即停止，并自动把识别出的文字发给 AI（不附带截图）。',
    en: 'to start — text appears in the status bar while you speak; press the same shortcut again to stop, and the transcript is sent to the AI automatically (with no screenshot).'
  },
  'help.asrSourceTitle': { zh: '听哪里', en: 'What it listens to' },
  'help.asrSourceSystem': {
    zh: '系统音频：识别电脑正在播放的声音，适合面试官的声音从扬声器或耳机里出来的场景，不需要装任何额外软件。',
    en: 'System audio hears what the computer is playing — the right choice when the interviewer comes out of your speakers or headphones, with nothing extra to install.'
  },
  'help.asrSourceMic': {
    zh: '麦克风：识别你自己念出来的题目。两个来源在「设置 → 音频输入设备」里切换。',
    en: 'Microphone hears you reading a question aloud. Switch sources in Settings → Audio input device.'
  },
  'help.asrSourceLanguage': {
    zh: '识别语言建议手动指定：中文内容选「简体中文」，自动检测在短句和系统音频上偶尔会认错语言。',
    en: 'Set the recognition language explicitly: pick "Simplified Chinese" for Chinese content, since auto-detect occasionally guesses wrong on short clips and system audio.'
  },
  'help.asrToolsTitle': { zh: '识别过程中的几个动作', en: 'While it runs' },
  'help.asrToolSubmit': { zh: '想立刻发送，按', en: 'To send right away, press' },
  'help.asrToolSubmitTail': {
    zh: '停止识别并马上提交，不必等停顿判定。',
    en: 'to stop and submit immediately instead of waiting for the pause check.'
  },
  'help.asrToolClear': { zh: '想丢掉这段文字，按', en: 'To throw the transcript away, press' },
  'help.asrToolClearTail': {
    zh: '清空当前识别文字，清除后不会发送。发送成功时文字也会自动清空。',
    en: 'to clear it without sending. A successful send clears it automatically too.'
  },
  'help.asrToolAutoSubmit': {
    zh: '「说完自动发送」可以让识别在你停顿一段时间后自己提交；停顿时长同样在设置里调整。',
    en: '"Auto-send when done" submits by itself after you pause for the configured time, which is also adjustable in Settings.'
  },
  'help.fullPageTitle': { zh: '整页截图（笔试 Chrome）', en: 'Full-page capture (exam Chrome)' },
  'help.fullPageBody': {
    zh: '题目在一个网页里、一屏截不全时用这个。应用会打开一个独立的 Chrome 窗口：用的是你电脑上自己装的 Chrome，和你日常用的浏览器互不打扰。截图在 Chrome 内部完成——整个网页一次性截成一张图发给 AI，页面上看不到任何变化，也不用滚动拼接。',
    en: 'Use this when the question lives in a webpage and does not fit one screen. The app opens a separate Chrome window: your own Chrome, kept apart from your daily browsing. The capture happens inside Chrome — the whole page becomes one image sent to the AI in a single shot, with nothing visible changing on the page and no scroll-stitching.'
  },
  'help.fullPageStepsTitle': { zh: '用法', en: 'How to use it' },
  'help.fullPageStep1': {
    zh: '点顶栏的 Chrome 图标启动笔试 Chrome；图标变蓝表示已就绪。',
    en: 'Click the Chrome icon in the top bar to start exam Chrome; it turns blue when ready.'
  },
  'help.fullPageStep2': {
    zh: '在那个窗口里打开题目网页。第一次登录后，登录状态会一直保留，和你的日常浏览互相独立。',
    en: 'Open the question page in that window. Sign in once and the session sticks around — fully separate from your daily browsing.'
  },
  'help.fullPageStep3': {
    zh: '按整页截图快捷键，整页内容会一次性发给 AI。超长页面会自动等比缩放。',
    en: 'Press the full-page capture shortcut and the whole page goes to the AI in one shot. Very long pages are scaled down automatically.'
  },
  'help.fullPageNote': {
    zh: '每次整页截图都会新开一段对话；关闭那个 Chrome 窗口后，应用会自动退出浏览器模式。',
    en: 'Each capture starts a new conversation; closing that Chrome window ends browser mode automatically.'
  },
  'help.privacyTitle': { zh: '隐私模式', en: 'Privacy mode' },
  'help.privacyBody': {
    zh: '开始答题前点一下顶栏的盾牌按钮，窗口就在别人的共享画面里「隐身」了。截图照常预览、方便你核对内容，但不会保存到磁盘。',
    en: 'Tap the shield button in the top bar before you start, and the window disappears from every shared view. Captures still preview in-app so you can check them, but are never written to disk.'
  },
  'help.privacyPointsTitle': { zh: '开启后会发生什么', en: 'What changes when it is on' },
  'help.privacyPoint1': {
    zh: '屏幕共享与录屏中都不可见（系统级内容保护）',
    en: 'Invisible in screen sharing and recordings (system-level content protection)'
  },
  'help.privacyPoint2': {
    zh: 'macOS 不进调度中心，Windows 不出现在任务栏',
    en: 'Hidden from Mission Control on macOS and the Windows taskbar'
  },
  'help.privacyPoint3': {
    zh: 'macOS 的 Dock 图标一并隐藏，窗口保持置顶',
    en: 'The macOS Dock icon hides too, and the window stays on top'
  },
  'help.privacyPoint4': {
    zh: '截图不写入磁盘；应用内预览保留，方便核对',
    en: 'Screenshots are never saved to disk — the in-app preview remains so you can check them'
  },
  'help.privacyNote': {
    zh: '个别会议软件对受保护窗口有自己的处理，正式使用前建议用你自己的会议软件实测一次。',
    en: 'A few meeting apps handle protected windows their own way — test once with your own meeting app before relying on it.'
  },
  'help.windowTitle': { zh: '窗口、布局与透明度', en: 'Window, layout and transparency' },
  'help.windowBody': {
    zh: '窗口始终置顶，并且不会因为点击而抢走下面页面的焦点：看完答案直接继续答题即可。',
    en: 'The window is always on top and never steals focus from the page underneath when you click it: read the answer and carry on working.'
  },
  'help.windowLayoutTitle': { zh: '标准模式与紧凑模式', en: 'Standard and compact layouts' },
  'help.windowLayoutBody': {
    zh: '标准模式显示完整答案、状态栏和底部工具栏；紧凑模式收成一个正方形小面板，只留答案、错误提示和右上角的返回键，其余操作全部交给快捷键和底部工具栏。两种模式用同一个快捷键或顶栏按钮切换，窗口大小会跟着变。',
    en: 'The standard layout shows the full answer, a status bar and the bottom toolbar. Compact mode collapses to one square panel with just the answer, an error row and a return button in the top-right corner; everything else moves to shortcuts and the bottom toolbar. One shortcut or header button switches between them, resizing the window.'
  },
  'help.windowPassthroughTitle': { zh: '鼠标穿透', en: 'Mouse passthrough' },
  'help.windowPassthroughBody': {
    zh: '开启后窗口对鼠标「隐身」，点击会落到下面的页面上，窗口本身看不见也点不到。但把鼠标移到顶栏图标、底部工具栏或滚动条上，它们会自动恢复可点；快捷键在任何时候都可用。顶栏的指针按钮和快捷键都能开关它，开启状态会一直保留，直到你再关掉。切换鼠标穿透的快捷键是',
    en: 'With passthrough on, the window becomes invisible to the mouse: clicks land on the page below and the window itself cannot be clicked. Hover the header icons, the bottom toolbar or the scroll rail and they come back to life; shortcuts always work. The pointer button in the top bar and the shortcut both toggle it, and the state persists until you turn it off. The shortcut that toggles it is'
  },
  'help.windowTransparencyTitle': { zh: '透明度与字号', en: 'Opacity and text size' },
  'help.windowTransparencyBody': {
    zh: '窗口整体是一张磨砂玻璃，透明度在「设置 → 外观设置」里拖动调整，也可以直接用快捷键逐步增减；主界面、紧凑模式和设置页用的是同一档透明度。答案字号同样在设置里选，代码块会跟着等比缩放。',
    en: 'The window is one frosted-glass sheet. Adjust its opacity in Settings → Appearance, or step it with the shortcuts; the main window, compact mode and the settings pages all share the same setting. Answer text size is chosen there too, with code blocks scaling along with it.'
  },
  'help.historyTitle': { zh: '会话历史', en: 'Conversation history' },
  'help.historyBody': {
    zh: '每完成一轮问答，这段对话都会自动保存。顶栏的历史按钮打开历史面板，左边选一条会话，右边就能看到当时的每一轮问题和答案。',
    en: 'Every completed exchange is saved automatically. The history button in the top bar opens the history panel: pick a conversation on the left and read each question and answer on the right.'
  },
  'help.historyRulesTitle': { zh: '需要知道的几条规则', en: 'A few rules to know' },
  'help.historyRule1': {
    zh: '只保存文字：问题和答案都在，截图不入库。',
    en: 'Text only: questions and answers are kept, screenshots are not.'
  },
  'help.historyRule2': {
    zh: '最多保留最近 20 段会话，更早的会自动淘汰。',
    en: 'The 20 most recent conversations are kept; older ones drop off automatically.'
  },
  'help.historyRule3': {
    zh: '可以在面板里删除单条记录，删除后无法恢复。',
    en: 'Single records can be deleted from the panel, and deletion cannot be undone.'
  },
  'help.faqTitle': { zh: '常见问题', en: 'FAQ' },
  'help.faq1Q': { zh: '如何截取屏幕截图？', en: 'How do I capture the screen?' },
  'help.faq1A': {
    zh: '即可截取当前屏幕，截图会立即显示在窗口里。',
    en: 'and the current screen is captured — the screenshot appears in the window right away.'
  },
  'help.faq2Q': {
    zh: '题目超过一屏怎么办？',
    en: 'What if a question spans more than one screen?'
  },
  'help.faq2A': {
    zh: '即可在当前对话里追加一张截图，AI 会结合两张图继续作答。',
    en: 'and another screenshot is appended to the same conversation, so the AI answers with both in view.'
  },
  'help.faq3Q': {
    zh: '分享屏幕时，对方能看到这个窗口吗？',
    en: 'Can others see this window while I share my screen?'
  },
  'help.faq3A': {
    zh: '默认会看到：窗口出现在共享画面里。打开隐私模式（顶栏盾牌按钮）后，窗口对屏幕共享和录屏不可见。个别会议软件需要额外配置，正式使用前务必用当前电脑和会议软件实测一次。',
    en: 'By default, yes — the window shows up in the shared view. Turn on privacy mode (the shield button in the top bar) and the window becomes invisible to screen sharing and recording. A few meeting apps need extra configuration, so always test on your own machine and meeting app first.'
  },
  'help.faq4Q': {
    zh: '鼠标移到窗口上，会不会挡住下面的操作？',
    en: 'Will the window block what is underneath?'
  },
  'help.faq4A': {
    zh: '顶栏按钮或快捷键可以开关鼠标穿透。开启后窗口对鼠标「隐身」，但顶栏图标、底部工具栏和滚动条悬停一下就能唤起，快捷键也一直可用。切换鼠标穿透的快捷键是',
    en: 'A top-bar button or shortcut toggles mouse passthrough. With it on, the window goes invisible to the mouse — but hover the header icons, the toolbar or the scroll rail and they come right back; shortcuts always work. The shortcut that toggles it is'
  },
  'help.faq4Tail': { zh: '。', en: '.' },
  'help.faq5Q': {
    zh: '语音识别是什么？怎么用？',
    en: 'What is speech recognition and how do I use it?'
  },
  'help.faq5A': {
    zh: '开启后可以实时把面试官说的话、或你念出来的题目转成文字（本地识别，录音不会离开这台电脑）。使用前在「设置 → 语音识别」里完成一键配置（自动安装识别引擎并下载模型），然后按下',
    en: 'It turns what the interviewer says — or a question you read aloud — into text in real time (recognition runs on your device, audio never leaves your machine). Run the one-click setup in Settings → Speech Recognition first (it installs the engine and downloads the model), then press'
  },
  'help.faq5Tail': {
    zh: '开始识别，再次按下该快捷键即可停止，并把识别出的文字直接发给 AI 生成回答（不会附带屏幕截图）。语音识别与截图相互独立，互不影响。',
    en: 'to start; press the same shortcut again to stop and send the transcript to the AI (without a screenshot). Recognition and screenshots are independent.'
  },
  'help.faq6Q': {
    zh: '识别出的文字可以单独清除吗？',
    en: 'Can I clear the transcript separately?'
  },
  'help.faq6A': {
    zh: '即可清除当前识别文字，清除后不会发送给 AI。发送时也会自动清除。',
    en: 'to clear the current transcript without sending it to the AI. Submitted transcripts are cleared automatically as well.'
  },
  'help.faq7Q': {
    zh: '如何识别系统正在播放的声音（而不是麦克风）？',
    en: 'How do I capture the audio my computer is playing (instead of the microphone)?'
  },
  'help.faq7A': {
    zh: '在「设置 → 音频输入设备」里选「系统音频」，就能识别电脑正在播放的声音（macOS 13.2+ 和 Windows 都支持，不用装任何额外软件）。识别中文时，建议把「识别语言」设为「简体中文」——自动检测在系统声音上偶尔会认错语言。',
    en: 'Select "System audio" under Settings → Audio input device and the app hears everything your computer is playing (works on macOS 13.2+ and Windows — nothing extra to install). For Chinese content, set the recognition language to "Simplified Chinese": auto-detect can misjudge the language on short system-audio clips.'
  },
  'help.faq8Q': {
    zh: '怎么把整个网页（而不是当前屏幕）发给 AI？',
    en: 'How do I send a whole webpage (not just the visible screen) to the AI?'
  },
  'help.faq8A': {
    zh: '点顶栏的 Chrome 图标启动笔试 Chrome（详见上方「整页截图」），在那个窗口里做题，按整页截图快捷键即可——整页内容会完整发给 AI，页面不会有任何变化，超长页面会自动缩放。',
    en: 'Start exam Chrome via the Chrome icon in the top bar (see the full-page capture section above), take the exam in that window, then press the full-page capture shortcut — the whole page goes to the AI, nothing visible changes on the page, and very long pages are scaled down automatically.'
  },
  'help.pressTo': { zh: '按下', en: 'Press' },
  'help.troubleTitle': { zh: '故障排查', en: 'Troubleshooting' },
  'help.troubleIntro': {
    zh: '常见问题的症状与处理方式（应用内出现错误时，错误行的按钮通常已直达对应修复入口）：',
    en: 'Common symptoms and fixes (when an error appears in-app, the error row usually carries a button that goes straight to the fix):'
  },
  'help.troubleCapture': {
    zh: '截图没有反应：多半是屏幕录制权限未授予。打开 权限中心（设置 → 语音识别 → 权限中心）授权后重试；错误行也会出现带跳转按钮的提示。',
    en: 'Screenshot does nothing: the screen-recording permission is most likely missing. Grant it in the Permission Center (Settings → Speech recognition → Permission center) and retry; the error row will show a button that opens it.'
  },
  'help.troubleBrew': {
    zh: '一键配置提示未检测到 Homebrew（macOS）：先安装 Homebrew（https://brew.sh，设置页错误旁有直达按钮），再重新一键配置。',
    en: 'Setup reports Homebrew missing (macOS): install Homebrew first (https://brew.sh — the settings error row has a direct button), then run one-click setup again.'
  },
  'help.troubleModel': {
    zh: '模型下载失败或中断：检查网络后重新一键配置即可断点续传（已下载部分保留，不会从头开始）；确保磁盘有约 1 GB 空闲空间。',
    en: 'Model download failed or interrupted: check the network and run one-click setup again — the download resumes from where it stopped (partial progress is kept); make sure about 1 GB of disk space is free.'
  },
  'help.troubleApi': {
    zh: '回答报 API 错误：401/403 多为 Key 无效或欠费，在 设置 → 模型服务 检查 Key；429 为频率/额度限制，稍后重试；网络类错误检查 API 地址与代理。',
    en: 'API errors: 401/403 usually mean an invalid key or billing issue — check the key in Settings → Provider; 429 is rate/quota limited — retry later; network errors mean the API URL or proxy needs a look.'
  },
  'help.troubleAsr': {
    zh: '语音识别启动失败：先在 权限中心 确认麦克风（或系统音频所需）权限；提示未检测到引擎/模型时，到 设置 → 语音识别 运行一键配置。',
    en: 'Speech recognition fails to start: confirm the microphone (or the system-audio) permission in the Permission Center first; if the engine or model is missing, run one-click setup under Settings → Speech recognition.'
  },
  'help.troubleShortcuts': {
    zh: '快捷键无效：在 设置 → 快捷键 查看该键位状态，被其他应用占用（标黄）时换一个组合键即可。',
    en: 'A shortcut does nothing: check its state under Settings → Shortcuts; if another app occupies it (shown in yellow), pick a different combination.'
  },
  'help.supportTitle': { zh: '反馈与支持', en: 'Feedback and support' },
  'help.supportBody': {
    zh: '遇到问题、或者有想要的功能，都欢迎告诉我们。本页只做说明，反馈请走下面两个渠道：',
    en: 'Problems and feature ideas are both welcome. This page is documentation only — send feedback through either channel below:'
  },
  'help.supportIssuesTitle': { zh: '提交问题与功能请求', en: 'Bugs and feature requests' },
  'help.supportIssuesBody': {
    zh: '在 GitHub Issues 上提交问题报告和功能请求，附上系统版本与复现步骤会更快定位。',
    en: 'File bug reports and feature requests on GitHub Issues; include your OS version and reproduction steps to speed things up.'
  },
  'help.supportIssuesAddress': {
    zh: 'github.com/heyseere/open-interview/issues',
    en: 'github.com/heyseere/open-interview/issues'
  },
  'help.supportRepoTitle': { zh: '完整文档', en: 'Full documentation' },
  'help.supportRepoBody': {
    zh: '使用说明、更新日志与 API Key 申请指引都在仓库的 README 里。',
    en: 'Usage notes, release notes and API-key setup guidance all live in the repository README.'
  },
  'help.supportRepoAddress': {
    zh: 'github.com/heyseere/open-interview',
    en: 'github.com/heyseere/open-interview'
  },
  'help.readOnlyNote': {
    zh: '本页只做说明，不含任何操作入口；所有操作都在主窗口和设置里完成。',
    en: 'This page is documentation only — it holds no controls. Everything is operated from the main window and Settings.'
  },
  'fullPage.captureFailed': { zh: '整页截图失败', en: 'Full-page capture failed' },
  'provider.siliconflow': { zh: '硅基流动 SiliconFlow', en: 'SiliconFlow' },
  'provider.moonshot': { zh: '月之暗面 Moonshot (Kimi)', en: 'Moonshot (Kimi)' },
  'provider.zhipu': { zh: '智谱 GLM', en: 'Zhipu GLM' },
  'provider.qwen': { zh: '阿里云百炼 Qwen', en: 'Alibaba Bailian Qwen' },
  'provider.ollama': { zh: 'Ollama（本地）', en: 'Ollama (local)' },
  'provider.lmstudio': { zh: 'LM Studio（本地）', en: 'LM Studio (local)' },
  'provider.custom': { zh: '自定义', en: 'Custom' },
  'scene.coding': { zh: '解算法题', en: 'Coding problems' },
  'scene.english-exam': { zh: '英语考试', en: 'English exam' },
  'scene.general-qa': { zh: '通用问答', en: 'General Q&A' }
} as const

export type TranslationKey = keyof typeof messages
export type TranslationParams = Record<string, string | number>

/**
 * Main-process strings (errors, dialogs, setup progress). Same shape as the
 * renderer table; the two key sets never overlap.
 */
export const mainMessages = {
  // AI stream prompt extras
  'prompt.multiScreenshotNote': {
    zh: '注意：如果有多张截图，请结合所有截图内容进行完整分析，不要遗漏任何部分。',
    en: 'Note: if there are multiple screenshots, analyze all of them together for a complete answer — do not skip any part.'
  },

  // Generic
  'err.unknown': { zh: '未知错误', en: 'Unknown error' },

  // Streaming / conversation actions
  'err.notReady': {
    zh: '尚未配置模型服务：打开 设置 → 模型服务，填写 API 地址并选择模型',
    en: 'No model provider configured — open Settings → Provider to set the API URL and model'
  },
  'err.apiAuthFailed': {
    zh: 'API Key 无效、未授权或额度不足，请在 设置 → 模型服务 中检查',
    en: 'The API key is invalid, unauthorized, or out of quota — check Settings → Provider'
  },
  'err.apiRateLimited': {
    zh: '请求过于频繁或额度受限，请稍后重试',
    en: 'Rate limited or out of quota — try again shortly'
  },
  'err.apiServerError': {
    zh: '模型服务暂时不可用（{status}），请稍后重试',
    en: 'The provider is temporarily unavailable ({status}) — try again shortly'
  },
  'err.apiNetworkFailed': {
    zh: '网络连接失败，请检查网络与 API 地址',
    en: 'Network connection failed — check the network and the API URL'
  },
  'err.apiTimeout': {
    zh: '请求超时，请重试或检查 API 地址',
    en: 'The request timed out — retry or check the API URL'
  },
  'err.screenPermissionDenied': {
    zh: '无法截取屏幕：请在 系统设置 → 隐私与安全性 → 屏幕录制 中允许本应用',
    en: 'Screen capture failed: allow this app under System Settings → Privacy & Security → Screen Recording'
  },
  'err.captureEmpty': {
    zh: '截屏失败：未捕获到画面，请重试',
    en: 'Capture failed: the picture came back empty — try again'
  },
  'err.screenshotSaveFailed': {
    zh: '截图保存失败：{message}',
    en: 'Failed to save the screenshot: {message}'
  },
  'err.emptyTranscript': { zh: '没有可发送的识别文字', en: 'No transcript to send' },
  'err.generateFailed': { zh: '回答已停止生成', en: 'Answer generation stopped' },
  'err.nothingToRetry': { zh: '没有可重试的请求', en: 'Nothing to retry' },
  'err.retryFailed': { zh: '重试未完成', en: 'Retry did not complete' },
  'err.noConversation': { zh: '当前没有可追问的对话', en: 'No active conversation to follow up' },
  'err.unknownAction': { zh: '不支持的操作', en: 'Unsupported action' },
  'err.actionFailed': { zh: '操作执行失败', en: 'Action failed' },

  // Transcription engine
  'err.alreadyRunning': { zh: '语音识别正在进行中', en: 'Speech recognition is already running' },
  'err.transcribeFailed': { zh: '语音识别失败', en: 'Speech recognition failed' },
  'label.localModel': { zh: '本地模型', en: 'Local model' },

  // whisper.cpp
  'err.noCli': {
    zh: '未检测到识别引擎，请在设置中运行一键配置',
    en: 'Recognition engine not found — run one-click setup in Settings'
  },
  'err.noModel': {
    zh: '本地语音模型未下载，请在设置中运行一键配置',
    en: 'Local speech model not downloaded — run one-click setup in Settings'
  },
  'err.transcribeTimeout': { zh: '本地语音识别超时', en: 'Local recognition timed out' },
  'err.serverTimeout': {
    zh: '识别引擎启动超时，请重试',
    en: 'The recognition engine took too long to start — retry'
  },
  'err.serverExited': {
    zh: '识别引擎已退出，请重试',
    en: 'The recognition engine exited — retry'
  },
  'err.noPort': {
    zh: '没有可用的本地端口，请关闭其他程序后重试',
    en: 'No free local port — close other apps and retry'
  },
  'err.spawnFailed': {
    zh: '无法启动 {command}：{message}',
    en: 'Failed to start {command}: {message}'
  },
  'err.commandExit': {
    zh: '{command} 已退出（代码 {code}）',
    en: '{command} exited with code {code}'
  },
  'setup.prepareEngine': { zh: '正在准备识别引擎…', en: 'Preparing the recognition engine…' },
  'setup.prepareModel': {
    zh: '正在准备模型（仅首次下载）…',
    en: 'Preparing the model (first download only)…'
  },
  'setup.stillMissing': {
    zh: '识别引擎安装后仍不可用，请重试',
    en: 'Engine is still unavailable after install — retry'
  },
  'setup.installWithBrew': {
    zh: '正在用 Homebrew 安装 whisper.cpp…',
    en: 'Installing whisper.cpp with Homebrew…'
  },
  'setup.brewMissing': {
    zh: '未检测到 Homebrew。请先安装 Homebrew（https://brew.sh），再回到这里一键配置',
    en: 'Homebrew was not found. Install it first (https://brew.sh), then run one-click setup again'
  },
  'setup.brewFailed': {
    zh: 'Homebrew 安装 whisper.cpp 失败，请检查网络后重试',
    en: 'Homebrew could not install whisper.cpp — check the network and retry'
  },
  'setup.installWithWinget': {
    zh: '正在用 winget 安装识别引擎…',
    en: 'Installing the engine with winget…'
  },
  'setup.wingetInstalling': {
    zh: '正在安装 {id}…',
    en: 'Installing {id}…'
  },
  'setup.wingetUnavailable': {
    zh: 'winget 中没有可用的 whisper.cpp 包，改为下载官方预编译包…',
    en: 'winget has no whisper.cpp package — downloading the official prebuilt build instead…'
  },
  'setup.engineReady': {
    zh: '识别引擎已就绪（{source}）',
    en: 'The recognition engine is ready ({source})'
  },
  'label.engineBrew': { zh: 'Homebrew', en: 'Homebrew' },
  'label.engineWinget': { zh: 'winget', en: 'winget' },
  'label.engineDownloaded': { zh: '已下载', en: 'Downloaded' },
  'label.enginePath': { zh: '系统 PATH', en: 'System PATH' },
  'setup.downloadEngine': {
    zh: '正在下载识别引擎预编译包（{tag}）…',
    en: 'Downloading the prebuilt engine package ({tag})…'
  },
  'setup.extracting': { zh: '正在解压安装…', en: 'Extracting…' },
  'setup.noCliInArchive': {
    zh: '压缩包中未找到识别引擎，请重试或手动安装',
    en: 'Engine not found in the archive — retry or install it manually'
  },
  'setup.downloadModel': {
    zh: '正在下载模型（仅首次）…',
    en: 'Downloading the model (first run only)…'
  },
  'setup.modelDownloadFailed': {
    zh: '模型下载失败，请检查网络后重试（已下载部分会保留，重试时断点续传）',
    en: 'Model download failed — check the network and retry (partial progress is kept and resumed)'
  },
  'setup.diskFull': {
    zh: '磁盘空间不足：下载模型需要约 1 GB 空闲空间，请清理后重试',
    en: 'Not enough disk space: downloading the model needs about 1 GB free — free up space and retry'
  },
  'setup.downloadProgress': {
    zh: '已下载 {received} MB / {total} MB（{percent}%）',
    en: 'Downloaded {received} MB / {total} MB ({percent}%)'
  },
  'setup.downloadProgressNoTotal': { zh: '已下载 {received} MB', en: 'Downloaded {received} MB' },
  'download.failed': { zh: '下载失败（HTTP {status}）', en: 'Download failed (HTTP {status})' },

  // Model list
  'err.apiUrlInvalid': { zh: 'API 地址格式不正确', en: 'Invalid API URL' },
  'err.apiUrlProtocol': {
    zh: 'API 地址必须使用 HTTP 或 HTTPS 协议',
    en: 'The API URL must use HTTP or HTTPS'
  },
  'err.apiUrlEmpty': { zh: '请先填写 API Base URL', en: 'Fill in the API Base URL first' },
  'err.modelListHttp': {
    zh: '模型列表请求失败（HTTP {status}）',
    en: 'Model list request failed (HTTP {status})'
  },
  'err.modelListInvalid': { zh: '模型列表响应格式无效', en: 'Invalid model list response' },
  'err.modelListTimeout': {
    zh: '获取模型列表超时，请检查 API 地址',
    en: 'Fetching the model list timed out — check the API URL'
  },

  // Full-page capture (dedicated exam Chrome via CDP)
  'chrome.notFound': {
    zh: '未找到 Google Chrome，请先安装 Chrome 后重试',
    en: 'Google Chrome not found — install Chrome and try again'
  },
  'chrome.launchFailed': {
    zh: '启动笔试 Chrome 失败：{message}',
    en: 'Failed to launch the exam Chrome: {message}'
  },
  'chrome.notRunning': {
    zh: '笔试 Chrome 未运行，请点击顶栏 Chrome 图标启动后重试',
    en: 'The exam Chrome is not running — start it from the Chrome icon in the header'
  },
  'chrome.connectTimeout': {
    zh: '连接笔试 Chrome 超时，请重试',
    en: 'Connecting to the exam Chrome timed out — try again'
  },
  'chrome.noPage': { zh: '没有找到可截取的网页', en: 'No web page available to capture' },
  'chrome.captureFailed': {
    zh: '整页截图失败：{message}',
    en: 'Full-page capture failed: {message}'
  },
  'chrome.examClosed': {
    zh: '笔试 Chrome 已关闭，浏览器模式已退出',
    en: 'The exam Chrome was closed — browser mode is off'
  },

  // Dialogs
  'dialog.selectScreenshotDir': { zh: '选择截图保存目录', en: 'Choose screenshot save folder' },

  // Conversation history placeholders
  'history.imagePlaceholder': { zh: '[截图]', en: '[screenshot]' },
  'history.blankTitle': { zh: '空白会话', en: 'Blank conversation' },

  // Auto-updater (Windows)
  'update.availableTitle': { zh: '发现新版本', en: 'Update available' },
  'update.availableMessage': { zh: '检测到新版本可用。', en: 'A new version is available.' },
  'update.availableDetail': { zh: '现在下载并安装更新吗？', en: 'Download and install it now?' },
  'update.downloadNow': { zh: '立即下载', en: 'Download now' },
  'update.later': { zh: '稍后', en: 'Later' },
  'update.readyTitle': { zh: '更新已就绪', en: 'Update ready' },
  'update.readyMessage': { zh: '更新已下载完成。', en: 'The update has been downloaded.' },
  'update.readyDetail': { zh: '是否立即重启以应用更新？', en: 'Restart now to apply the update?' },
  'update.restartNow': { zh: '立即重启', en: 'Restart now' }
} as const

export type MainMessageKey = keyof typeof mainMessages
