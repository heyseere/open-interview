# Open Interview

[English](README.md) | **简体中文**

看到题目，按一下快捷键，答案就在旁边。

一个永久开源免费的面试/笔试辅助工具：把屏幕上的题截下来交给 AI，答案流式显示在一个置顶的小窗里——不用切窗口，不用复制粘贴，也不打断你正在写的代码。

支持 **macOS（Apple Silicon）** 与 **Windows 10/11**。

---

## 适合什么场景

- **在线笔试 / 测评**：题目在网页或客户端里，一屏看不完也没关系
- **技术面试**：边听边想，需要快速过一遍思路或复杂度分析
- **刷题与读论文**：看到看不懂的题干、公式、代码片段，想立刻要个解释
- **英语试题**：阅读理解、完形、翻译，直接给出答案和解析

## 功能特性

### 截图即得答案

- 一个快捷键截取当前屏幕，视觉大模型流式作答，字符边生成边出现
- 一次没截全？追加截图会接着同一个对话继续问，上下文不丢
- 「解算法题」「英语考试」「通用问答」等场景提示词可编辑、可自建，顶部下拉或 `Alt+S` 随时切换
- 答案解析保持在你看到的位置，不跟着生成内容乱滚；代码块一键复制，字号三档可调
- 网页整页截图：题目在一个长网页里时，用内置的笔试 Chrome 一次性截下整页（原生整页渲染，非拼接）

### 本地语音转录

- 基于 whisper.cpp，识别引擎在首次配置时通过 Homebrew（macOS）或 winget（Windows）自动安装，不需要编译环境
- 模型首次一键下载，之后完全离线；模型大小可选，识别语言含中文 / 英文
- **边说边识别**：常驻识别进程 + 滑动窗口，无需等待固定分段；只在语句停顿处落定文字，未说完的部分以浅色实时预览
- 停顿后自动提交（可开关，停顿时长可调）
- 可直接采集系统正在播放的声音（面试官语音），无需虚拟声卡

### 隐私与窗口控制

- 隐私模式：窗口对屏幕共享/录屏不可见、隐藏 Dock/任务栏图标、截图不写入磁盘（界面内预览照常）
- 紧凑提词模式：小窗只留答案与转录行，可拖拽缩放，贴边跟读；底部工具栏同样可用
- 悬停工具栏：指针停留即触发，窗口变窄自动排成两行，按需显示/隐藏每个按钮
- 窗口置顶半透明，位置与大小自动记忆，透明度快捷键即时调节

### 模型与配置

- 内置 12 个模型提供商预设（OpenAI、硅基流动、DeepSeek、Moonshot、智谱、阿里云百炼、OpenRouter、Gemini、Claude、Ollama、LM Studio、自定义），各自独立保存地址、密钥与模型，一键切换
- 思考强度对所有模型开放：OpenAI 系走 `reasoning_effort`，DeepSeek / Qwen / 智谱走各自的原生思考字段
- API Key 通过系统安全存储（Electron safeStorage）**加密保存**，不落在本地明文里
- 模型列表自动拉取、也可手动填写，支持一键**测试连接**；快捷键被系统或其他软件占用时会在设置里提示
- 截图可选保存到本地目录；中英双语界面一键切换

---

## 下载安装

从 [GitHub Releases](https://github.com/heyseere/open-interview/releases) 下载：

| 平台 | 文件 |
| ---- | ---- |
| macOS（Apple Silicon） | `open-interview-0.1.0.dmg` 或 `open-interview-0.1.0-arm64-mac.zip` |
| Windows 10/11 | `open-interview-0.1.0-setup.exe` |

> **未签名构建**：Release 产物未做代码签名与公证：
>
> - **macOS（Apple Silicon）**：系统可能提示应用「已损坏」或来自未知开发者。先试右键 → 打开；若仍提示「已损坏」，在终端执行 `xattr -cr "/Applications/Open Interview.app"` 后重新打开。
> - **Windows**：SmartScreen 会提示「Windows 已保护你的电脑」——点击**更多信息** → **仍要运行**。

首次使用：

1. 进入「设置」页，填写 API Base URL 与 API Key，选择模型
2. （可选）「语音转录」区点击**一键配置**：自动安装识别引擎（macOS 走 Homebrew，需先装好 Homebrew；Windows 走 winget，缺包时下载官方预编译包）并下载模型，之后完全离线可用
3. 从源码运行时，也可以在项目根目录创建 `.env` 预配置，启动时自动读取为默认值：

   ```env
   API_BASE_URL="https://openrouter.ai/api/v1"
   API_KEY="sk-..."
   MODEL="gpt-5-mini"
   ```

---

## 默认快捷键

| 功能 | macOS | Windows |
| ---- | ----- | ------- |
| 截图并解题（新会话） | `Alt+Enter` | `Ctrl+Enter` |
| 追加截图 | `Alt+Shift+Enter` | `Ctrl+Shift+Enter` |
| 停止生成 | `Alt+.` | `Ctrl+.` |
| 追问 | `Alt+F` | `Ctrl+F` |
| 语音转录 开/停+提交 | `Alt+T` | `Ctrl+T` |
| 清除转录文本 | `Alt+Shift+T` | `Ctrl+Shift+T` |
| 切换提示词场景 | `Alt+S` | `Ctrl+S` |
| 隐藏/显示窗口 | `Alt+H` | `Ctrl+H` |
| 鼠标穿透 | `Alt+M` | `Ctrl+M` |
| Mini/紧凑面板 | `Alt+L` | `Ctrl+L` |
| 透明度 调高/调低 | `Cmd+]` / `Cmd+[` | `Ctrl+]` / `Ctrl+[` |
| 上/下翻页 | `Cmd+J / Cmd+K` | `Ctrl+J / Ctrl+K` |
| 移动窗口 | `Cmd+方向键` | `Ctrl+方向键` |

所有快捷键均可在设置页自定义，并可绑定鼠标侧键。

---

## 从源码运行

需要 Node.js（建议 22+）。

```bash
npm install          # 安装依赖
npm run dev          # 开发模式
npm run build:mac    # 构建 macOS 包
npm run build:win    # 构建 Windows 安装包
npm run test         # 单元测试
npm run typecheck    # 类型检查
npm run lint         # ESLint
```

完整贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 关于隐身能力的说明

隐身功能适配市面上大部分会议软件（如腾讯会议等），但少量软件和浏览器可能无法正常隐身。**使用前请自行测试，本项目不承担任何责任。**

**能力边界**：

- 应用通过系统接口对屏幕捕获隐藏自身窗口，并持续重申该属性；但这只能防御“合规读取屏幕画面”的软件，**操作系统级的录屏工具或内核级键盘记录器不在任何应用的防御范围内**
- 建议的自查方式：在腾讯会议 / 浏览器标签共享中开启共享，观察对方画面是否出现本应用窗口
- 所有 API Key 通过系统钥匙串加密存储，不会明文落盘；语音识别全程在本机完成（音频只在内存中交给本地 whisper 进程，不落盘、不保存、不上传）

---

## 免责声明

1. **使用风险自负**：本工具仅供个人学习、技术研究使用。请勿在违反考试规则、法律法规或平台服务条款的场景中使用，使用后果由使用者自行承担。
2. **不保证有效性**：隐身能力、识别准确性依赖第三方软件与 AI 模型，本项目对其不提供任何明示或默示的担保。
3. **AI 输出仅供参考**：AI 生成的解答可能存在错误，请自行核对关键结论。

---

## 许可协议

本项目采用 **[MIT License](LICENSE)** 开源。

---

## 致谢

本项目起源于 [ooboqoo](https://github.com/ooboqoo) 的开源项目 [interview-coder-cn](https://github.com/ooboqoo/interview-coder-cn)，感谢原作者的开创性工作。
