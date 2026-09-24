<h1 align="center">Attention Is All You Need</h1>

<p align="center">
  <strong>attention-plugins</strong> · 轻量级 DSH Web 插件：智能任务通知，主线/支线管理<br/>
  <em>Lightweight DSH Web plugin — smart session notifications with main-line / side-line orchestration</em>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-47%20passed-brightgreen)](./tests/)
[![DSH Version](https://img.shields.io/badge/DSH-%E2%89%A50.1.6--alpha.1-blue)](https://github.com/deepseek-ai/dsh-harness)

[English](#english) | [中文](#中文)

---

## 中文

### 功能特性

- ✅ **4 种事件通知**：完成、失败、提问、权限请求
- ⭐ **主线/支线管理**：主线任务立即响，支线全部完成才响一次
- 🎯 **⭐ 一键标记**：会话标题栏 + 输入框工具行两处标记主线，新会话发消息前即可标记
- 🔊 **3 种内置音效**：Chime / Success / Subtle（Web Audio 实时合成）
- 🔔 **浏览器通知**：离开标签页时弹出系统通知
- 🎛️ **灵活配置**：独立的设置面板，音量可调，事件独立开关
- ✨ **动效面板**：设置面板标题「Attention is all you need」衬线排版 + 图纸式自注意力连线图（浅色图版深色墨线、query 轮换、印刷品级对比、零辉光），主线标记直接内嵌原神原石官方贴图（尊重 `prefers-reduced-motion`）
- 🧪 **测试覆盖**：47 个单元测试，100% 通过

### 快速开始

**要求**：DeepSeek Harness ≥ 0.1.6-alpha.1

```bash
# 从本地安装
cd /path/to/attention-plugins
pnpm install && pnpm run build
dsh plugin --profile web add file:$(pwd)

# 重启 DSH Web
dsh web
```

安装后：
1. 打开 **Settings → Attention** 配置插件
2. 打开任意会话，标题栏右侧看到 **☆ 设为主线** 按钮；或在新会话（尚未发送第一条消息时）输入框工具行左侧找到 **☆** 小图标
3. 点击 `☆` → 变成 `⭐ 主线`（橙色高亮）；新会话可在发出第一条消息之前就标记为主线

### 使用场景

#### 场景 1：主线任务优先

```
启动 4 个任务：A（主线）、B、C、D
- A 完成 → 🔔 立即通知
- B、C、D 依次完成 → 静默
- 所有支线完成 → 🔔 "All side-line tasks completed"
```

#### 场景 2：纯支线模式

```
启动 3 个任务：A、B、C（都不标记主线）
- A 完成 → 静默
- B 完成 → 静默
- C 完成 → 🔔 "All tasks completed"
```

#### 场景 3：阻塞交互

```
会话运行中需要回答问题
→ 🔔 通知 + 🎵 Chime（question 事件）
→ 用户返回查看并回答
```

### 配置选项

**设置面板**（Settings → Attention）：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 🔊 声音通知 | 总开关 | ✅ 开启 |
| 🎵 音效选择 | Chime / Success / Subtle | Chime |
| 🔉 音量 | 0-100% | 70% |
| 🔔 浏览器通知 | 系统通知 | ❌ 关闭 |
| 👁️ 为当前会话也通知 | 正在查看的会话也响 | ❌ 关闭 |

**事件独立配置**：

| 事件 | 默认音效 | 说明 |
|------|----------|------|
| ✅ Completed | Chime | 任务成功完成 |
| ⚠️ Failed | Subtle | 任务执行失败 |
| ❓ Question | Success | 需要用户回答 |
| 🔒 Permission | Success | 需要用户授权 |

**⭐ 主线标记**：
- 位置 1：会话标题栏右侧（带文字按钮）
- 位置 2：输入框工具行左侧（紧凑小图标，新会话发消息前即可用）
- 未标记：`☆`（灰色）
- 已标记：`⭐`（橙色高亮）

### 技术实现

- **事件检测**：监听 `api-session/status` 远程事件
- **边沿检测**：跟踪 `running` 状态（true → false = 完成）
- **失败检测**：监听 `api-session/error`（agent loop 的真实失败；用户主动中止不会触发），按「本轮运行期间是否新增错误」归属
- **提问 / 权限检测**：这两类**没有**对应的 `api-session/*` 远程事件，唯一来源是 UI 状态源 `ctx.uiSession.sessionStatus` 里的 `pendingInteraction`（`kind: 'question' | 'plan-review' | 'approval'`）；通过 `ctx.inject(['uiSession'])` 订阅，首帧静默只记录基线
- **音效合成**：Web Audio API（OscillatorNode + GainNode）
- **通知**：Notification API（需用户授权）
- **存储**：localStorage（`attention-plugins:config`）
- **Slot 注入**：`conversation.session.header.utilities`（⭐ 按钮）+ `conversation.input.left`（输入框工具行 ⭐ 小图标）

### 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm run build

# 监听模式
pnpm run watch

# 运行测试
pnpm test

# 清理
pnpm run clean
```

**测试覆盖**：
```
✓ tests/engine.test.ts (21 tests)
✓ tests/mainline-sideline-advanced.test.ts (16 tests)
✓ tests/pending.test.ts (10 tests)

Test Files  3 passed (3)
Tests  47 passed (47)
```

### 路线图

- [x] 4 种事件类型（completed / failed / question / permission）
- [x] 主线/支线逻辑
- [x] ⭐ 主线标记按钮（header slot）
- [x] ⭐ 主线标记小图标（composer 工具行，发消息前可用）
- [x] 声音提示（3 种内置音效）
- [x] 浏览器系统通知
- [x] 设置面板 UI
- [x] 设置面板动效（衬线标题 + 图纸式连线图 / 官方原石贴图标记 / 卡片入场）
- [x] 中英文本地化
- [x] 47 个单元测试
- [ ] npm 发布
- [ ] 社区插件目录收录
- [ ] 更多音效选择
- [ ] 自定义音频上传

**未来展望**：详见 [`docs/vision.md`](docs/vision.md)

### 致谢

基于 [@dingyi222666/dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification) 的架构设计（MIT License），完全重写并扩展为支持主线/支线逻辑的版本。

### 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## English

### Features

- ✅ **4 Event Types**: completed, failed, question, permission
- ⭐ **Main/Side-line Management**: Main-line alerts immediately, side-line alerts when ALL finish
- 🎯 **⭐ One-click Marker**: Mark main-line from the conversation header or the composer tool row — available before the first message of a new session
- 🔊 **3 Built-in Sounds**: Chime / Success / Subtle (Web Audio synthesis)
- 🔔 **Browser Notifications**: System notifications when away
- 🎛️ **Flexible Config**: Dedicated settings panel, volume control, per-event switches
- ✨ **Animated Panel**: serif-typeset "Attention is all you need" title over a printed-plate self-attention figure (dark ink lines on a near-white plate, rotating query, zero glow); the mainline marker embeds the official Genshin Primogem texture (honours `prefers-reduced-motion`)
- 🧪 **Test Coverage**: 47 unit tests, 100% passed

### Quick Start

**Requirements**: DeepSeek Harness ≥ 0.1.6-alpha.1

```bash
# Install from local
cd /path/to/attention-plugins
pnpm install && pnpm run build
dsh plugin --profile web add file:$(pwd)

# Restart DSH Web
dsh web
```

After installation:
1. Open **Settings → Attention** to configure
2. Open any session, see **☆ Set as Main** button in header
3. Click `☆` → becomes `⭐ Main` (orange highlight)

### Use Cases

#### Scenario 1: Main-line Priority

```
Start 4 tasks: A (main), B, C, D
- A completes → 🔔 Alert immediately
- B, C, D complete → Silent
- All side-line done → 🔔 "All side-line tasks completed"
```

#### Scenario 2: Pure Side-line Mode

```
Start 3 tasks: A, B, C (no main-line marked)
- A completes → Silent
- B completes → Silent
- C completes → 🔔 "All tasks completed"
```

#### Scenario 3: Blocking Interaction

```
Session asks a question
→ 🔔 Notification + 🎵 Chime (question event)
→ User returns to answer
```

### Configuration

**Settings Panel** (Settings → Attention):

| Option | Description | Default |
|--------|-------------|---------|
| 🔊 Sound Notifications | Master switch | ✅ On |
| 🎵 Sound Effect | Chime / Success / Subtle | Chime |
| 🔉 Volume | 0-100% | 70% |
| 🔔 Browser Notifications | System notifications | ❌ Off |
| 👁️ Alert for Current Session | Also notify when viewing | ❌ Off |

**Per-event Configuration**:

| Event | Default Sound | Description |
|-------|---------------|-------------|
| ✅ Completed | Chime | Task finished successfully |
| ⚠️ Failed | Subtle | Task execution failed |
| ❓ Question | Success | User answer required |
| 🔒 Permission | Success | User authorization needed |

**⭐ Main-line Marker**:
- Location: Conversation header right side
- Unmarked: `☆ Set as Main` (gray)
- Marked: `⭐ Main` (orange highlight)

### Technical Implementation

- **Event Detection**: Listens to `api-session/status` remote events
- **Edge Detection**: Tracks `running` state (true → false = completed)
- **Failure Detection**: Listens to `api-session/error` (a genuine agent-loop failure; a user-initiated abort does not raise it), attributed to the run that was active
- **Question / Permission Detection**: neither has an `api-session/*` remote event — the only source is `pendingInteraction` on the UI status source `ctx.uiSession.sessionStatus` (`kind: 'question' | 'plan-review' | 'approval'`), subscribed via `ctx.inject(['uiSession'])`; the first frame only records a baseline
- **Sound Synthesis**: Web Audio API (OscillatorNode + GainNode)
- **Notifications**: Notification API (requires user permission)
- **Storage**: localStorage (`attention-plugins:config`)
- **Slot Injection**: `conversation.session.header.utilities` (⭐ button)

### Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run watch

# Run tests
pnpm test

# Clean
pnpm run clean
```

**Test Coverage**:
```
✓ tests/engine.test.ts (21 tests)
✓ tests/mainline-sideline-advanced.test.ts (16 tests)
✓ tests/pending.test.ts (10 tests)

Test Files  3 passed (3)
Tests  47 passed (47)
```

### Roadmap

- [x] 4 event types (completed / failed / question / permission)
- [x] Main-line/side-line logic
- [x] ⭐ Main-line marker button (header slot)
- [x] Sound notifications (3 built-in effects)
- [x] Browser notifications
- [x] Settings panel UI
- [x] Settings panel motion (serif title + printed-plate figure / official Primogem texture marker / card entrance)
- [x] English/Chinese localization
- [x] 47 unit tests
- [ ] npm publish
- [ ] Community plugin directory listing
- [ ] More sound effects
- [ ] Custom audio upload

**Future Vision**: See [`docs/vision.md`](docs/vision.md)

### Credits

Based on the architecture of [@dingyi222666/dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification) (MIT License), completely rewritten and extended with main-line/side-line logic.

### License

MIT License - see [LICENSE](LICENSE)
