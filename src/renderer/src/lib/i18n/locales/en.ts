import type { TranslationKey, TranslationParams } from './zh-CN'

export const en: Record<TranslationKey, string> = {
  // Generic
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.retry': 'Retry',
  'common.loading': 'Loading...',
  'common.seconds': '{n}s',

  // App header / shell
  'app.title': 'Open Interview',

  // Coder page
  'coder.pressShortcut': 'Press',
  'coder.shortcutGroupAi': 'Capture & voice',
  'coder.shortcutGroupWindow': 'Window',
  'coder.screenshotAlt': 'Screenshot {n}',
  'coder.screenshotTitle': 'Screenshot {n}',

  // Error banner

  // Status bar
  'status.stopGenerating': 'Stop',
  'status.appendScreenshot': 'Append screenshot',
  'status.newConversation': 'New session',
  'status.followUp': 'Follow-up',
  'status.followUpPlaceholder': 'Type your follow-up, Ctrl+Enter to submit...',
  'status.followUpFailed': 'Send failed — retry or check network and API settings',
  'status.newSession': 'New session',

  // Header feature buttons
  'header.privacyOn': 'Privacy mode on: invisible to screen sharing/recording, dock icon hidden',
  'header.privacyOff': 'Privacy mode off: the window is visible to screen sharing',
  'header.passThroughOff': 'Enable mouse passthrough (restore via shortcut or the toolbar)',
  'header.passThroughOn':
    'Passthrough on — clicks cannot restore here; use the shortcut or hover the toolbar',
  'header.history': 'Conversation history',
  'header.toggleCompact': 'Compact teleprompter mode',

  // Transcription bar
  'transcription.waitingForSpeech': 'Waiting for speech...',
  'transcription.chunkProcessing': 'Transcribing ({processed}/{total} chunks)',
  'transcription.chunkProcessed': '{n} chunks transcribed',

  // Compact ticker
  'compact.waiting': 'Waiting for generation...',
  'compact.exitStandard': 'Back to standard layout',

  // History dialog
  'history.title': 'Conversation history',
  'history.empty': 'No conversations yet',
  'history.turnCount': '{n} turns',
  'history.textOnlyNote': 'Text only — screenshots are not stored',
  'history.deleteConfirmText': 'Delete this conversation record? This action cannot be undone.',
  'history.loadFailed': 'Failed to load conversation',

  // Transcription errors (coder page)
  'transcriptionError.sendFailed': 'Failed to send transcription',
  'transcriptionError.stopFailed': 'Failed to stop transcription',
  'transcriptionError.startFailed':
    'Failed to start transcription. Run one-click setup in Settings and check the system permission.',
  'transcriptionError.mediaPermissionDenied':
    'Microphone / screen-recording permission denied — allow this app in System Settings → Privacy & Security',

  // Permissions page
  'permission.title': 'Permissions',
  'permission.entry': 'System permissions',
  'permission.entryHint':
    'Screen recording and microphone access for screenshots and transcription',
  'permission.openCenter': 'Permission center',
  'permission.screenTitle': 'Screen recording',
  'permission.screenDesc': 'Captures the screen for questions and system audio for transcription',
  'permission.micTitle': 'Microphone',
  'permission.micDesc': 'Use a microphone as the transcription input device',
  'permission.requestAction': 'Request',
  'permission.openSettings': 'Open System Settings',
  'permission.statusGranted': 'Granted',
  'permission.statusDenied': 'Denied',
  'permission.statusNotDetermined': 'Not requested',
  'permission.statusRestricted': 'Restricted',
  'permission.statusUnknown': 'Unknown',
  'permission.devNote':
    'In dev mode macOS attributes permission prompts to the spawning terminal, so the app never shows one — test the permission flow with a packaged build',
  'permission.grantedNote': 'No separate permission is required on this system',
  'permission.deniedNote':
    'A denied permission never re-prompts — allow this app manually in System Settings → Privacy & Security',

  // Local transcription (settings)
  'settings.localModelLabel': 'Model size',
  'settings.localModelHint': 'One-click setup for the engine and model — fully offline afterwards',
  'settings.localSetupAction': 'Set up',
  'settings.localSetupDone': 'Ready',
  'settings.localSetupFailed': 'Setup failed',
  'settings.localSetupCancel': 'Cancel',
  'settings.localSetupCancelled': 'Setup cancelled',
  'settings.localSetupStageEngine': 'Preparing the recognition engine (slow on first run)',
  'settings.localSetupStageModel': 'Downloading/verifying model (first run only)',
  'settings.localStatusCli': 'Recognition engine (whisper.cpp)',
  'settings.localStatusCliMissing': 'Not installed — run one-click setup',
  'settings.localStatusModel': 'Model',
  'settings.localStatusOk': 'Ready',
  'settings.localStatusCachedOthers': 'Cached',
  'settings.localModelNeedsDownload': 'Not downloaded — setup will fetch this model',
  'settings.localLanguageLabel': 'Recognition language',
  'settings.localLanguageHint': 'Spoken language for transcription; auto detects it',
  'settings.localLanguageAuto': 'Auto-detect',
  'settings.localLanguageZh': 'Chinese',
  'settings.localLanguageEn': 'English',
  'settings.localVerifyAction': 'Test 3s',
  'settings.localVerifyHint': 'Record 3 seconds and show the raw transcript (never sent to the AI)',
  'settings.localVerifyResult': 'Result',
  'settings.localVerifyNoSpeech': 'No speech detected — check the input device and try again',
  'settings.localVerifyDone': 'Local recognition verified',

  // Settings page
  'settings.title': 'Settings',
  'settings.aiSection': 'AI Settings',
  'settings.apiBaseUrlHint': 'SiliconFlow example: https://api.siliconflow.cn/v1',
  'settings.apiBaseUrlPlaceholder': 'Optional, defaults to the official OpenAI API',
  'settings.apiKeyPlaceholder': 'Enter API Key',
  'settings.modelHint': 'Search in the dropdown, or click "Fetch models"',
  'settings.transcriptionSection': 'Speech Transcription',
  'settings.chunkLabel': 'Chunk duration',
  'settings.chunkHint': 'Audio length per chunk; longer is more accurate but slower',
  'settings.chunkDecrease': 'Decrease by 1s',
  'settings.chunkIncrease': 'Increase by 1s',
  'settings.autoSubmitLabel': 'Auto-submit on silence',
  'settings.autoSubmitHint': 'Auto-submit after you pause speaking — no shortcut needed',
  'settings.vadSilenceLabel': 'Silence threshold',
  'settings.vadSilenceHint': 'Auto-submit after silence lasts this long',
  'settings.inputDeviceLabel': 'Audio input device',
  'settings.inputDeviceHint':
    'Leave empty to capture system audio; the button on the right reads device names (requests microphone access)',
  'settings.refreshDevicesHint': 'Read device names (requires microphone access)',
  'settings.systemAudio': 'System audio (default)',
  'settings.outputDeviceLabel': 'Audio output device',
  'settings.outputDeviceHint': 'Monitoring output while transcribing',
  'settings.defaultDevice': 'Default device',
  'settings.solverSection': 'Solver Settings',
  'settings.sceneLabel': 'Scenes',
  'settings.sceneHint': 'Each scene has an editable system prompt; changes save automatically',
  'settings.renameScene': 'Rename scene',
  'settings.deleteScene': 'Delete scene',
  'settings.addScene': 'Add scene',
  'settings.promptLabel': 'System prompt',
  'settings.promptSceneSuffix': 'scene',
  'settings.resetPrompt': 'Reset this scene to its default prompt',
  'settings.resetPromptAction': 'Reset default',
  'settings.promptPlaceholder':
    'e.g.: You are a problem-solving assistant. Answer based on the screenshot and speech.',
  'settings.addSceneTitle': 'Add scene',
  'settings.addSceneDescription': 'Give the new scene its own system prompt after creating it',
  'settings.sceneNamePlaceholder': 'Scene name, e.g.: Math exam',
  'settings.create': 'Create',
  'settings.deleteSceneTitle': 'Delete scene',
  'settings.deleteSceneDescription':
    'Delete scene "{name}"? Its prompt will be removed permanently.',
  'settings.renameSceneTitle': 'Rename scene',
  'settings.renameSceneDescription':
    'Set a new name for this custom scene. Preset scenes cannot be renamed.',
  'settings.appearanceSection': 'Appearance',
  'settings.opacityLabel': 'Window opacity',
  'settings.opacityHint': 'Drag to preview live',
  'settings.opacityTransparent': 'Transparent',
  'settings.opacityOpaque': 'Opaque',
  'settings.languageLabel': 'Language',
  'settings.languageHint': 'Switch the UI language',
  'settings.shortcutsSection': 'Shortcuts',
  'settings.shortcutsHint': 'Shortcuts fully apply only on the main page',
  'settings.saveScreenshotsSection': 'Save Screenshots',
  'settings.autoSaveLabel': 'Save screenshots locally',
  'settings.autoSaveHint': 'Every screenshot will be saved to the chosen directory',
  'settings.saveDirLabel': 'Save directory',
  'settings.saveDirHint': 'Click the value on the right to pick a new directory',
  'settings.saveDirAction': 'Click to choose directory',
  'settings.saveDirDefault': 'Default: Pictures/InterviewCoder',
  'settings.privacySection': 'Privacy',
  'settings.privacyNote': 'Captured images are uploaded only to the AI provider you configured',
  'settings.privacyModeLabel': 'Privacy mode',
  'settings.privacyModeHint':
    'On: invisible to screen sharing/recording, dock icon hidden (macOS), screenshots never saved to disk or previewed',
  'settings.renameFailed': 'Rename failed: invalid name or duplicate of an existing scene',

  // Toasts
  'toast.compactModeEntered':
    'Entered compact panel — press {key} to return to the standard layout',

  // Hover toolbar
  'toolbar.voice': 'Transcribe',
  'toolbar.autoSubmit': 'Auto-submit on silence',
  'toolbar.submitTranscript': 'Submit transcript',
  'toolbar.clearTranscript': 'Stop & clear transcript',
  'toolbar.takeScreenshot': 'Screenshot & solve',
  'toolbar.regenerate': 'Resubmit',
  'settings.toolbarLabel': 'Hover toolbar',
  'settings.toolbarHint': 'Floating toolbar at the bottom — hover or click to trigger',
  'settings.dwellLabel': 'Dwell duration',
  'settings.dwellHint': 'How long to hover before a button fires (0.2–1s)',
  'settings.dwellDecrease': 'Decrease by 0.1s',
  'settings.dwellIncrease': 'Increase by 0.1s',

  // Mini layout
  'compact.statusIdle': 'Idle',
  'compact.statusGenerating': 'Generating',
  'compact.statusTranscribing': 'Transcribing',

  // SelectModel
  'model.selectPlaceholder': 'Select model...',
  'model.searchOrCreate': 'Search or create...',
  'model.noResults': 'No results',
  'model.create': 'Create "{name}"',
  'model.count': '{n} models',
  'model.staleHint': 'list is from another API, refresh to update',
  'model.fetchAction': 'Fetch models',
  'model.fetchTitleReady': 'Fetch available models from the API',
  'model.fetchTitleBlocked': 'Fill in the API Base URL and API Key in Settings first',
  'model.needConfig': 'Fill in the API Base URL and API Key in Settings first',
  'model.fetched': 'Fetched {n} models from the API',
  'model.fetchFailed': 'Failed to fetch model list',

  // Custom shortcuts
  'shortcuts.windowManagement': 'Window Management',
  'shortcuts.hideOrShow': 'Hide/show window',
  'shortcuts.mousePassThrough': 'Mouse passthrough',
  'shortcuts.mousePassThroughDesc': 'Clicks pass through to the content behind the window',
  'shortcuts.toggleMiniMode': 'Mini mode',
  'shortcuts.screenshotAndAi': 'Screenshot & AI',
  'shortcuts.takeScreenshot': 'Screenshot',
  'shortcuts.takeScreenshotDesc': 'Capture and solve (starts a new chat)',
  'shortcuts.appendScreenshot': 'Append screenshot',
  'shortcuts.appendScreenshotDesc': 'Add a screenshot to the current conversation',
  'shortcuts.stopGenerating': 'Stop generating',
  'shortcuts.stopGeneratingDesc': 'Interrupt the answer being generated',
  'shortcuts.followUpQuestion': 'Follow-up',
  'shortcuts.followUpQuestionDesc': 'Open the follow-up input box',
  'shortcuts.toggleTranscription': 'Speech transcription',
  'shortcuts.toggleTranscriptionDesc': 'Press once to start; press again to stop & submit',
  'shortcuts.clearTranscription': 'Clear transcript',
  'shortcuts.clearTranscriptionDesc': 'Clear transcribed text (not submitted)',
  'shortcuts.navigation': 'Navigation',
  'shortcuts.pageUp': 'Page up',
  'shortcuts.pageDown': 'Page down',
  'shortcuts.windowMovement': 'Window Movement',
  'shortcuts.moveUp': 'Move window up',
  'shortcuts.moveDown': 'Move window down',
  'shortcuts.moveLeft': 'Move window left',
  'shortcuts.moveRight': 'Move window right',
  'shortcuts.recording': 'Press a key combo or mouse middle/side button — Esc to cancel',
  'shortcuts.resetSuccess': 'Shortcuts reset to defaults',
  'shortcuts.resetAction': 'Reset defaults',

  // Help page (long-form prose)
  'help.title': 'Help Center',
  'help.introTitle': 'Introduction',
  'help.introBody':
    'Welcome to Open Interview! Whether it is a coding interview, an online exam, or any other problem-solving scenario, this tool captures your screen and suggests answers.',
  'help.repoLink': 'GitHub repository',
  'help.introTail': 'for more help (stealth setup, API keys, and more).',
  'help.featuresTitle': 'Main features:',
  'help.featureScreenshot': 'Capture the screen with a shortcut and get a suggested solution.',
  'help.featureStealth':
    'The window hides itself from screen sharing (invisible to others; a few meeting apps may need extra configuration).',
  'help.featureOverlay':
    'The window stays on top and semi-transparent, so your cursor never leaves the task and the page keeps focus.',
  'help.quickStartTitle': 'Quick start',
  'help.step1Title': '1. Capture the screen',
  'help.step1Body': 'When you need help with a question, press',
  'help.step1Tail': 'to capture the screen. The screenshot appears in the app right away.',
  'help.step2Title': '2. Read the result',
  'help.step2Body':
    'The screenshot is analysed with the active prompt scene, which returns the reasoning and the answer.',
  'help.supportTitle': 'Contact support',
  'help.supportBody': 'Found a problem or have a suggestion? Reach us here:',
  'help.supportIssuesTitle': 'GitHub Issues',
  'help.supportIssuesBody': 'to file bug reports and feature requests',
  'help.shortcutsTitle': 'Shortcuts',
  'help.shortcutsDesc':
    'Shortcuts are the main way to drive the app; you can customise them in Settings.',
  'help.catWindowManagement': 'Window Management',
  'help.catScreenshotAi': 'Screenshot & AI',
  'help.catNavigation': 'Navigation',
  'help.catWindowMovement': 'Window Movement',
  'help.descHideOrShow': 'Hide / show the window',
  'help.descMousePassThrough': 'Mouse passthrough (window ignores the mouse)',
  'help.descTakeScreenshot': 'Capture the screen and generate a solution (starts a new chat)',
  'help.descAppendScreenshot': 'Append a screenshot to the current conversation',
  'help.descStop': 'Stop generating',
  'help.descFollowUp': 'Open the follow-up input',
  'help.descToggleTranscription': 'Start transcription; press again to stop and submit',
  'help.descClearTranscription': 'Clear the transcript (without submitting)',
  'help.descPageUp': 'Page up',
  'help.descPageDown': 'Page down',
  'help.descMoveUp': 'Move the window up',
  'help.descMoveDown': 'Move the window down',
  'help.descMoveLeft': 'Move the window left',
  'help.descMoveRight': 'Move the window right',
  'help.faqTitle': 'FAQ',
  'help.faq1Q': 'How do I capture the screen?',
  'help.faq1A':
    'Press this shortcut to capture the screen; the screenshot appears in the app right away.',
  'help.faq2Q': 'What if a question spans more than one screen?',
  'help.faq2A': 'Press this shortcut to append another screenshot to the same conversation.',
  'help.faq3Q': 'Can others see the app while I share my screen?',
  'help.faq3A':
    'The window hides itself when the screen is shared (invisible to others), though a few meeting apps need extra configuration. If stealth matters to you, always test with your own machine and meeting app first.',
  'help.faq4Q': 'Does the cursor change when it passes over the window?',
  'help.faq4A':
    'A header button or shortcut toggles mouse passthrough. With passthrough on, the window ignores the mouse and you drive it with shortcuts or the hover toolbar. The shortcut that toggles it is',
  'help.faq4Tail': '.',
  'help.faq5Q': 'What is speech transcription and how do I use it?',
  'help.faq5A':
    'It turns the interviewer voice or a spoken question into text in real time (local whisper.cpp recognition — audio never leaves your machine). Run one-click setup in Settings first (downloads the engine and model on first use), then press',
  'help.faq5Tail':
    'to start; press the same shortcut again to stop and send the transcript to the AI (without a screenshot). Transcription and screenshots are independent.',
  'help.faq6Q': 'Can I clear the transcript separately?',
  'help.faq6A':
    'clears the current transcript without sending it to the AI. A submitted transcript is cleared automatically as well.',
  'help.pressTo': 'Press',
  'help.visitProject': 'Visit the',
  'help.onPage': 'on',

  // Prerequisites checker (first-run)
  'welcome.title': 'Welcome to Open Interview',
  'welcome.introPrefix': 'Configure an AI gateway first, e.g.',
  'welcome.siliconflowName': 'SiliconFlow',
  'welcome.introMiddle': '(China) or',
  'welcome.introSuffix': '.',
  'welcome.baseUrlHint': '(the API Base URL of SiliconFlow or another provider)',
  'welcome.apiKeyPlaceholder': 'Enter API Key',
  'welcome.start': 'Get started',
  'welcome.moreSettings': 'More settings'
}

export type { TranslationKey, TranslationParams }
