# Open Interview

永久开源免费的多功能面试/笔试助手。

支持 **macOS（Apple Silicon）** 与 **Windows 10/11**。

---

## 功能特性

### 截屏解题

- 快捷键抓取屏幕内容，视觉大模型流式输出解答，边生成边显示
- 追加截图延续同一对话：多题连问、长题目分屏截取，上下文不丢失
- 预置「解算法题」「英语考试」「通用问答」等场景化提示词，可编辑、可自建

### 本地语音转录

- 基于 whisper.cpp（`whisper-cli` + ggml 模型），自动下载引擎与模型
- 可根据设备配置自由选择模型大小，识别语言包括：中文 / 英文
- 分段时长可调，可静音自动提交

### 隐身与窗口控制

- 隐身模式：对屏幕共享/录屏不可见、隐藏 Dock/任务栏图标
- Mini 面板：可切换小窗只保留答案与转录行，可拖拽缩放，适合贴边跟读
- 悬停工具栏：转录 / 截图 / 生成三段式控制，指针**悬停即触发**

### 隐私与配置

- API Key 通过系统安全存储（Electron safeStorage）**加密保存**
- 任意 **OpenAI 兼容 API** 均可使用，模型列表自动拉取，也可手动填写
- 截图可选保存到本地目录
- 中英双语界面，一键切换

---

## 下载安装

从 [GitHub Releases](https://github.com/heyseere/open-interview/releases) 下载：

| 平台 | 文件 |
| ---- | ---- |
| macOS（Apple Silicon） | `open-interview-1.0.0.dmg` 或 `open-interview-1.0.0-arm64-mac.zip` |
| Windows 10/11 | `open-interview-1.0.0-setup.exe` |

首次使用：

1. 进入「设置」页，填写 API Base URL 与 API Key，选择模型
2. （可选）「语音转录」区点击**一键配置**，自动准备 whisper.cpp 引擎与模型，之后完全离线可用
3. 也可以在项目根目录创建 `.env` 预配置，启动时自动读取为默认值：

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
| 隐藏/显示窗口 | `Alt+H` | `Ctrl+H` |
| 鼠标穿透 | `Alt+M` | `Ctrl+M` |
| Mini/紧凑面板 | `Alt+L` | `Ctrl+L` |
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

---

## 关于隐身能力的说明

隐身功能适配市面上大部分会议软件（如腾讯会议等），但少量软件和浏览器可能无法正常隐身。**使用前请自行测试，本项目不承担任何责任。**

**能力边界**：

- 应用通过系统接口对屏幕捕获隐藏自身窗口，并持续重申该属性；但这只能防御“合规读取屏幕画面”的软件，**操作系统级的录屏工具或内核级键盘记录器不在任何应用的防御范围内**
- 建议的自查方式：在腾讯会议 / 浏览器标签共享中开启共享，观察对方画面是否出现本应用窗口
- 所有 API Key 通过系统钥匙串加密存储，不会明文落盘；语音转录音频仅在内存中分块处理，不写入磁盘

---

## 免责声明

1. **使用风险自负**：本工具仅供个人学习、技术研究使用。请勿在违反考试规则、法律法规或平台服务条款的场景中使用，使用后果由使用者自行承担。
2. **不保证有效性**：隐身能力、识别准确性依赖第三方软件与 AI 模型，本项目对其不提供任何明示或默示的担保。
3. **无商业授权**：本项目采用 CC BY-NC 4.0 协议，禁止任何形式的商业用途。如需商业授权，请联系维护者。
4. **AI 输出仅供参考**：AI 生成的解答可能存在错误，请自行核对关键结论。

---

## 许可协议

本项目采用 **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh)**（知识共享-署名-非商业性使用 4.0 国际许可协议）。

您可以自由地共享与演绎本作品，但须给出适当署名，且不得用于商业目的。

---

## 致谢

本项目起源于 [ooboqoo](https://github.com/ooboqoo) 的开源项目 [interview-coder-cn](https://github.com/ooboqoo/interview-coder-cn)，感谢原作者的开创性工作。
