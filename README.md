# Open Interview

**English** | [简体中文](README.zh-CN.md)

See a question on your screen, press a shortcut, get the answer next to it.

Open Interview is a free, open-source assistant for interviews, written tests and study: capture what's on your screen and send it to an AI model — the answer streams into a small always-on-top window, so you never switch windows, copy-paste, or interrupt what you're working on.

Works on **macOS (Apple Silicon)** and **Windows 10/11**.

---

## What it's good for

- **Online tests / assessments** — questions live in a web page or a desktop client, longer than one screen is fine
- **Technical interviews** — think along while listening; quickly walk through an approach or a complexity analysis
- **Problem sets & papers** — stuck on a problem statement, formula or code fragment, get an explanation instantly
- **English exams** — reading comprehension, cloze, translation, with answers and explanations

## Features

### Screenshot → answer

- One shortcut captures the current screen; a vision model answers with tokens streaming in as they are generated
- Follow-up captures continue the same conversation, so context is never lost
- Editable scenario prompts ("Solve an algorithm problem", "English exam", "General Q&A", …) — switch from the header dropdown or `Alt+S`
- The answer stays where you put it instead of auto-scrolling; one-click copy for code blocks; three font sizes
- Full-page capture: when the questions live in one long web page, the built-in exam Chrome captures the entire page in a single native render (not stitched screenshots)

### Local voice transcription

- Powered by whisper.cpp — the engine is installed on first use via Homebrew (macOS) or winget (Windows), no build toolchain needed
- Model downloaded once with one click, fully offline afterwards; several model sizes, Chinese and English supported
- **Streaming as you speak**: a resident engine plus a sliding window — text settles at speech pauses, and the uncommitted tail is previewed in a lighter color in real time; auto-commit at pauses can be toggled and tuned
- Captures system audio directly (e.g. the interviewer's voice) — no virtual audio driver required

### Privacy & window control

- Privacy mode: the window is invisible to screen sharing/recording, the Dock/taskbar icon is hidden, and screenshots are not written to disk (in-app preview still works)
- Compact teleprompter mode: a small window with just the answer and the transcription row, resizable, with the full toolbar still available
- Hover toolbar: dwell to trigger; wraps to two rows when the window narrows; per-button visibility
- Always-on-top translucent window; position and size are remembered; opacity adjustable via shortcuts

### Models & configuration

- 12 built-in provider presets (OpenAI, SiliconFlow, DeepSeek, Moonshot, Zhipu, Alibaba Cloud Bailian, OpenRouter, Gemini, Claude, Ollama, LM Studio, custom), each with its own base URL, key and model; switch with one click
- Reasoning effort for all models: `reasoning_effort` for OpenAI-style APIs, native thinking fields for DeepSeek / Qwen / Zhipu
- API keys are **encrypted** via system secure storage (Electron safeStorage) — never in plaintext on disk
- Model lists fetched automatically or entered manually; one-click connection test; shortcut conflicts are flagged in settings
- Optional screenshot saving to a local folder; UI in English and Chinese

---

## Download & install

Grab a build from [GitHub Releases](https://github.com/heyseere/open-interview/releases):

| Platform | File |
| ---- | ---- |
| macOS (Apple Silicon) | `open-interview-0.1.0.dmg` or `open-interview-0.1.0-arm64-mac.zip` |
| Windows 10/11 | `open-interview-0.1.0-setup.exe` |

> **Unsigned builds.** Release artifacts are not code-signed or notarized:
>
> - **macOS (Apple Silicon)**: macOS may report the app as damaged or from an unidentified developer. Try right-click → Open once; if it still says "damaged", run `xattr -cr "/Applications/Open Interview.app"` in Terminal and open again.
> - **Windows**: SmartScreen will show "Windows protected your PC" — click **More info** → **Run anyway**.

First use:

1. Open **Settings**, fill in the API Base URL and API Key, pick a model
2. (Optional) In **Voice transcription**, click one-click setup: installs the recognition engine (macOS via Homebrew — install Homebrew first; Windows via winget, falling back to the official prebuilt zip) and downloads a model; fully offline afterwards
3. When running from source, you can preconfigure defaults with a `.env` file in the project root:

   ```env
   API_BASE_URL="https://openrouter.ai/api/v1"
   API_KEY="sk-..."
   MODEL="gpt-5-mini"
   ```

---

## Default shortcuts

| Action | macOS | Windows |
| ---- | ----- | ------- |
| Screenshot & solve (new session) | `Alt+Enter` | `Ctrl+Enter` |
| Follow-up screenshot | `Alt+Shift+Enter` | `Ctrl+Shift+Enter` |
| Stop generation | `Alt+.` | `Ctrl+.` |
| Follow-up question | `Alt+F` | `Ctrl+F` |
| Voice transcription on/off + commit | `Alt+T` | `Ctrl+T` |
| Clear transcription text | `Alt+Shift+T` | `Ctrl+Shift+T` |
| Switch prompt scenario | `Alt+S` | `Ctrl+S` |
| Hide/show window | `Alt+H` | `Ctrl+H` |
| Mouse passthrough | `Alt+M` | `Ctrl+M` |
| Mini/compact panel | `Alt+L` | `Ctrl+L` |
| Opacity up/down | `Cmd+]` / `Cmd+[` | `Ctrl+]` / `Ctrl+[` |
| Page up/down | `Cmd+J` / `Cmd+K` | `Ctrl+J` / `Ctrl+K` |
| Move window | `Cmd+arrows` | `Ctrl+arrows` |

All shortcuts are remappable in Settings, including mouse side buttons.

---

## Building from source

Requires Node.js (22+ recommended).

```bash
npm install          # install dependencies
npm run dev          # dev mode
npm run build:mac    # build the macOS bundle
npm run build:win    # build the Windows installer
npm run test         # unit tests
npm run typecheck    # type checks
npm run lint         # ESLint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

---

## A note on the stealth capability

The stealth features work with most mainstream meeting apps (e.g. Tencent Meeting), but a few apps and browsers may not be hidden. **Test with your own setup before relying on it — this project takes no responsibility.**

Boundaries:

- The app asks the OS to exclude its own window from screen capture and keeps re-asserting that property; this only defends against software that reads the screen through normal capture APIs — **OS-level screen recorders and kernel-level keyloggers are outside any application's defensive reach**
- Suggested self-check: start a screen/tab share in Tencent Meeting or a browser tab and see whether this window shows up on the other side
- API keys are stored encrypted in the system keychain and never hit disk in plaintext; voice recognition runs entirely on-device — audio is handed to the local whisper process in memory, never saved or uploaded

---

## Disclaimer

1. **Use at your own risk.** This tool is for personal learning and technical research only. Do not use it in any scenario that violates exam rules, laws, or platform terms of service; you bear all consequences of using it.
2. **No guarantee of effectiveness.** Stealth behavior and recognition accuracy depend on third-party software and AI models; this project provides no warranty, express or implied.
3. **AI output is for reference only.** Generated solutions can be wrong — verify the important conclusions yourself.

---

## License

This project is released under the [MIT License](LICENSE).

---

## Acknowledgements

This project started from [ooboqoo](https://github.com/ooboqoo)'s open-source project [interview-coder-cn](https://github.com/ooboqoo/interview-coder-cn) — thanks to the original author for the pioneering work.
