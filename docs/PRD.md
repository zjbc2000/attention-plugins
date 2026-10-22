# Attention Plugins - 产品需求文档 (PRD)

## 一、产品概述

**产品名称**：Attention Plugins (注意力插件)  
**版本**：v0.1.0  
**目标平台**：DeepSeek Harness Web GUI  
**最低 DSH 版本**：≥ 0.1.6-alpha.1

### 1.1 产品定位

一个轻量级的 DSH Web 插件，通过声音提示、浏览器通知和主线/支线任务管理，让用户在多任务并行时及时获得反馈，提升注意力管理效率。

### 1.2 核心价值

- **即时反馈**：会话任务完成时立即通知，无需频繁切换标签页查看状态
- **两种通知粒度**：默认每个任务结束各响一次（N 个任务 N 声）；也可切到全部结束才汇总响一次
- **多任务友好**：支持同时跟踪多个会话，离开标签页也不错过完成通知
- **低打扰**：当前正在查看的会话默认静音，避免不必要的干扰
- **视觉直观**：输入框工具行 / 会话行菜单的 ⭐ 一键标记主线，可同时标记多个，侧边栏常驻星标

---

## 二、功能需求

### 2.1 核心功能（Priority 1 - 已实现）

#### 功能 1：会话完成通知引擎

**需求描述**：检测会话完成事件，支持 4 种事件类型。

**事件类型**：
1. **completed**：任务成功完成
2. **failed**：任务执行失败（检测 turn-error 或 agent-error）
3. **question**：需要用户回答问题（阻塞交互）
4. **permission**：需要用户授权（approval 交互）

**实现要点**：
- 监听 DSH 的会话列表状态变化（`SessionListState`）
- 检测每个会话的 `running` 状态边沿（true → false）
- 区分成功/失败：对比 baseline 和当前的 `maxTurnErrorSeq` / `lastAgentError`
- 检测阻塞交互：订阅 pending interactions（question/approval）
- 100ms settle 窗口避免状态抖动

#### 功能 2：任务模式与支线通知方式（主线/支线任务逻辑）

**需求描述**：没有标记主线时，会话默认全算支线；可切换「主线模式 / 均衡模式」，让均衡模式下未标记主线的会话都视为主线并即时提醒。

**设置项（任务模式）**：`mainlineMode`，取值 `'mainline' | 'balanced'`，默认 `'mainline'`
- 存储：localStorage（`attention-plugins:config` → `mainlineMode`）
- 读取时机：每次判断某会话是否主线时读取，切换设置无需刷新页面即可生效
- `mainline`（默认，现有行为）：未标记主线的会话一律算支线，按 `sidelineMode` 提醒
- `balanced`（均衡模式）：**没有标记主线时**，所有会话都视为主线，每个任务完成或失败都立即提醒；一旦标记了主线，行为与 `mainline` 模式完全一致
- 判定逻辑：`isMainlineSession(id, markedIds, mode)`——`markedIds` 非空时按数组成员判定（可同时标记多个主线），为空时仅 `balanced` 视为主线

**设置项（支线通知方式）**：`sidelineMode`，取值 `'per-session' | 'batch'`，默认 `'per-session'`
- 存储：localStorage（`attention-plugins:config` → `sidelineMode`）
- 读取时机：**每次 run 结束时读取**，切换设置无需刷新页面即可生效

**`per-session` 模式（默认）**：
- **所有**会话（主线、支线一视同仁）完成时立即各自发一条通知
- N 个任务完成 = N 条通知 / N 声
- 失败分类（`failed` vs `completed`）对支线同样生效
- **不产生**任何 "All tasks" 汇总通知——逐个通知已经覆盖了信息，汇总只会造成重复打扰

**`batch` 模式**：
- 主线会话完成 → 立即触发通知（无论其他会话是否在运行）
- 支线任务完成 → 不立即响
- 所有会话都 idle → 触发一次 "All side-line tasks completed" 汇总通知
- 检测 "had running → all idle" 边沿，防止重复
- 主线完成时如果导致"全部 idle"，抑制支线汇总通知（避免重复）

**新一波任务**（`batch` 模式）：
- 当前波次全部完成后，新启动的任务算作新一波
- 新一波全部完成 → 再次触发支线汇总通知

**主线标记的定位**：
- 主线是**视觉标记**（侧边栏常驻星标、标记按钮），让用户一眼找到最关心的那些会话
- 支持**同时标记多个主线**：每个已标记会话各自获得即时提醒，侧边栏各显示一颗星标
- 在默认的 `per-session` 模式下，主线和支线的**通知行为完全一致**
- 在 `batch` 模式下，每个主线都获得"立即响"特权，支线仍汇总到"全部 idle"那条边沿
- `balanced` 模式下没有标记主线时，所有会话都按主线对待，`sidelineMode` 暂时不产生差异；标记了任意主线后，多主线规则与 `mainline` 模式一致

#### 功能 3：⭐ 主线标记（支持多个）

**需求描述**：用 ⭐ 标记任意多个会话为主线，每个会话独立标记 / 取消。

**实现要点**：
- 注入位置：
  - `conversation.input.left` slot（输入框工具行紧凑小图标，新会话发消息前即可用）
  - `sidebar.workspaces.session.menu.item` slot（会话行「…」菜单项，带文字）
- 按钮状态：
  - 未标记：`☆ 设为主线`（灰 / 透明）
  - 已标记：`⭐ 主线`（橙色高亮背景）
- 交互：点击切换**该会话**的主线状态，互不影响；可同时标记多个
- 存储：localStorage（`attention-plugins:config` → `mainlineSessionIds: string[]`；老版本的单值 `mainlineSessionId` 在读取时自动迁移为数组）
- 动态更新：共享 `mainlineStore`（缓存数组 + `toggle(id)` / `getSnapshot()`），所有已挂载的标记按钮与侧边栏星标实时同步
- 侧边栏：每个已标记会话标题前显示常驻星标；点击某颗星只取消对应会话

#### 功能 4：声音提示

**需求描述**：任务完成/失败/交互时播放声音提示。

**实现要点**：
- 使用 Web Audio API 实时合成（无需音频文件）
- 支持 3 种内置音效：
  1. **Chime**（默认）：轻快的钟声（800Hz → 600Hz，0.5s）
  2. **Success**：愉悦的成功音（C-E-G 三和弦，0.8s）
  3. **Subtle**：柔和的提示音（440Hz 单音，0.3s）
- 音量可调（0-100%，默认 70%）
- 遵守浏览器 autoplay 策略（需页面交互后才可播放）

**事件音效映射**：
- `completed` → 用户选择的音效
- `failed` → Subtle（低调提示错误）
- `question` / `permission` → Chime（引起注意）

#### 功能 5：浏览器系统通知

**需求描述**：会话完成时，如果用户不在当前标签页或查看其他会话，弹出浏览器系统通知。

**实现要点**：
- 使用浏览器 Notification API
- 通知内容包含：
  - **标题**：会话标题
  - **正文**：完成摘要（成功/失败/问题/权限）
- 触发条件：
  - 标签页在后台 (`document.hidden === true`) **或**
  - 用户正在查看其他会话（完成的会话非当前选中会话）
- 通知权限管理：
  - 首次开启时请求用户授权
  - 设置面板提供"测试通知"按钮验证权限

#### 功能 6：设置面板

**需求描述**：在 DSH 设置面板中新增"Attention"（注意力）设置区。

**设置项清单**：

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **声音通知** | 开关 | ✅ 开启 | 总控开关，关闭后所有声音静音 |
| **音效选择** | 下拉选择 | Chime | 可选：Chime / Success / Subtle |
| **音量** | 滑块 (0-100%) | 70% | 控制声音播放音量 |
| **浏览器通知** | 开关 | ❌ 关闭 | 总控开关，首次开启请求权限 |
| **为当前会话也通知** | 复选框 | ❌ 关闭 | 开启后当前查看的会话也发声/通知 |
| **任务模式** | 单选 | 主线模式 | 「主线模式」未标记主线即支线；「均衡模式」没有标记主线时所有任务都视为主线、逐任务即时提醒 |
| **支线通知方式** | 单选 | 每个任务结束就通知 | 「每个任务结束就通知」N 任务响 N 声 /「全部结束通知一次」响 1 声 |
| **测试通知** | 按钮 | - | 立即发送一条测试通知验证权限 |
| **主线任务标记** | 说明区 | - | 提示在输入框工具行 ⭐ 或会话「…」菜单标记，支持同时标记多个 |

**独立事件开关**（4 种事件类型）：

| 事件类型 | 默认声音 | 默认浏览器通知 |
|----------|----------|----------------|
| ✅ Completed | ✅ 开启 | ❌ 关闭 |
| ⚠️ Failed | ✅ 开启 | ❌ 关闭 |
| ❓ Question | ✅ 开启 | ❌ 关闭 |
| 🔒 Permission | ✅ 开启 | ❌ 关闭 |

**UI 集成方式**：
- 通过 `ctx.slots.settings.section` 注册进设置面板
- 设置项使用原生 HTML + inline CSS（不依赖 DSH UI 组件）
- 配置持久化到浏览器 localStorage（key: `attention-plugins:config`）

---

## 三、技术方案

### 3.1 插件形态

- **类型**：DSH Bundle Plugin
- **包结构**：
  ```
  attention-plugins/
  ├── package.json          # 包声明，dsh.bundle 配置
  ├── cordis.patch.yml      # bundle patch 层
  ├── src/
  │   ├── index.ts          # host 半（注册设置命名空间）
  │   ├── settings.ts       # 设置 schema（共享）
  │   └── client/
  │       ├── index.ts      # 客户端入口，注册 slots
  │       ├── engine.ts     # 完成事件检测引擎
  │       ├── sounds.ts     # Web Audio 音效合成
  │       ├── notification.ts # 浏览器通知
  │       ├── settings.tsx  # 设置面板 UI
  │       ├── mainline-button.tsx # ⭐ 主线按钮组件
  │       └── locales.ts    # 中英文本地化
  ├── tests/
  │   ├── engine.test.ts                      # 基础测试（15 个）
  │   └── mainline-sideline-advanced.test.ts  # 高级测试（16 个）
  ├── lib/                  # 构建产物
  └── docs/
      ├── PRD.md            # 本文档
      └── vision.md         # 产品展望
  ```

### 3.2 核心依赖

**灵感来源**：`@dingyi222666/dsh-session-notification` (MIT License)
- 参考其事件检测引擎架构（`NotificationEngine`）
- 完全重写，支持 4 种事件类型和主线/支线逻辑
- 新增 92 个单元测试覆盖核心逻辑

**DSH 客户端依赖**：
- `@deepseek-ai/dsh-api-session-controller` - 会话状态订阅
- `@deepseek-ai/dsh-client-ui-settings` - 设置面板 slot
- `@deepseek-ai/dsh-client-locale` - 国际化
- `@deepseek-ai/dsh-client-ui-slots` - Slot 系统（注入 composer 按钮与会话菜单项）

### 3.3 关键技术点

#### 3.3.1 支线模式判定逻辑

```typescript
// 核心状态
private hadRunning = false               // 上一轮是否有 running 会话
private prevRunning = new Map<string, boolean>()  // 每个会话的上一轮 running 状态

// 只在 batch 模式下才产生汇总通知
private aggregates(): boolean {
  return this.ports.sidelineMode() === 'batch'
}

observe(sessions: SessionListState) {
  let hasRunning = false
  let mainlineJustCompleted = false
  
  for (const session of sessions) {
    const prevRunning = this.prevRunning.get(session.id) ?? false
    const nowRunning = session.running
    
    // 检测 true → false 边沿
    if (prevRunning && !nowRunning) {
      void this.settleRun(session.id)  // 分类事件（completed/failed）
      
      if (isMainline(session.id)) {
        mainlineJustCompleted = true  // 标记主线完成
      }
    }
    
    if (nowRunning) hasRunning = true
    this.prevRunning.set(session.id, nowRunning)
  }
  
  // batch 模式：检测"had running → all idle"边沿
  // per-session 模式下每个会话已各自通知，汇总只会重复
  if (this.aggregates() && this.hadRunning && !hasRunning && !mainlineJustCompleted) {
    this.emitSidelineComplete()
  }
  
  this.hadRunning = hasRunning
}
```

#### 3.3.2 事件分类（completed vs failed）

```typescript
// 在 100ms settle 窗口后分类事件
async settleRun(sessionId: string) {
  await settle()  // 等待 100ms
  
  const detail = getSessionDetail(sessionId)
  const baseline = this.runs.get(sessionId)
  
  // 检测错误增量
  const failed = (
    detail.maxTurnErrorSeq > baseline.baselineErrorSeq ||
    (detail.lastAgentError !== null && detail.lastAgentError !== baseline.baselineAgentError)
  )
  
  const kind = failed ? 'failed' : 'completed'
  const message = failed 
    ? (detail.failureMessage ?? detail.lastAgentError)
    : detail.finalText
  
  // per-session（默认）：所有会话逐个发
  // batch：只有主线发，支线交给"all idle"汇总
  if (isMainline(sessionId) || !this.aggregates()) {
    emit({ kind, sessionId, title, detail: message })
  }
}
```

#### 3.3.3 ⭐ 按钮 Slot 注入

```typescript
// 注册到 conversation.input.left slot（会话行菜单另有一处）
ctx.slots.inject('conversation.input.left', () =>
  ctx.slots.register({
    name: 'conversation.input.left',
    id: 'attention-mainline',
    order: 100,  // 显示顺序
    inject: () => ({
      onToggle: (id) => mainlineStore.toggle(id),   // 多主线：数组内增删
      t: (key) => translate(key),
      setSeen: (id) => { viewTracker.current = id },
    }),
  }, MainlineComposerButton)
)
```

#### 3.3.4 Web Audio 音效合成

```typescript
// Chime: 800Hz → 600Hz 滑音
function playChime(ctx: AudioContext, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  
  osc.frequency.setValueAtTime(800, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.5)
  
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
  
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
}
```

---

## 四、用户体验流程

### 4.1 首次安装流程

1. 用户执行安装命令：
   ```bash
   dsh plugin --profile web add link:/path/to/attention-plugins
   ```
2. 刷新浏览器（`link:` 安装时构建产物即时生效，无需重启 DSH Web）
3. 打开 Settings → Attention，看到默认配置：
   - ✅ 声音提示（Chime，70% 音量）
   - ❌ 浏览器通知（默认关闭）
   - ❌ 为当前会话也通知
   - 📋 主线标记说明（提示在输入框工具行 / 会话「…」菜单标记，支持多个）
4. 打开任意会话，输入框工具行左侧看到 `☆`，或会话行「…」菜单里看到「☆ 设为主线」
5. 点击一次标记、再点一次取消；可同时标记多个会话
6. 点击"测试通知"验证效果

### 4.2 日常使用场景

**场景 1：单会话专注工作**
- 用户在 A 会话中等待长时间任务（如代码生成）
- 点击 `⭐ 主线` 标记这是主线任务
- 切换标签页刷微博
- A 会话完成 → 🔔 浏览器通知 + 🎵 Chime 音效
- 用户切回标签页查看结果

**场景 2：多会话并行（默认 per-session）**
- 用户同时运行 A、B、C、D 四个会话
- **A 完成** → 🔔 通知 A
- **B 完成** → 🔔 通知 B
- **C 完成** → 🔔 通知 C
- **D 完成** → 🔔 通知 D（4 个任务 = 4 声，不额外汇总）

**场景 3：多会话并行 + batch 汇总模式**
- 用户在设置面板把「支线通知方式」切到「全部结束通知一次」
- 同时运行 A（主线）、B、C、D
- **A 完成** → 🔔 立即通知（主线特权）
- **B 完成** → 静默（还有 C、D 在跑）
- **C 完成** → 静默（还有 D 在跑）
- **D 完成** → 🔔 "All side-line tasks completed"（支线全部完成）

**场景 4：纯支线模式（不标记主线，batch 模式）**
- 用户同时运行 A、B、C 三个会话，都不标记主线
- A 完成 → 静默
- B 完成 → 静默
- C 完成 → 🔔 "All side-line tasks completed"

**场景 4b：均衡模式（不标记主线，batch 模式）**
- 用户在设置面板把「任务模式」切到「均衡模式」
- 同时运行 A、B、C，都不标记主线
- A 完成 → 🔔 立即通知 A
- B 完成 → 🔔 立即通知 B
- C 完成 → 🔔 立即通知 C（不产生 "All tasks" 汇总；标记主线后恢复主线模式行为）

**场景 5：需要安静的环境**
- 用户在图书馆/会议中
- 临时关闭"声音提示"开关
- 保留浏览器通知（静默但可见）

**场景 6：阻塞交互**
- 会话运行中遇到问题，需要用户回答
- 🔔 通知 + 🎵 Chime（question 事件）
- 用户返回查看并回答

---

## 五、测试覆盖

### 5.1 单元测试（92 个测试，100% 通过）

**基础测试**（`engine.test.ts`，27 个）：
- ✅ **per-session 模式（默认）**：支线会话各自完成即通知
- ✅ **per-session 模式**：N 个任务 = N 条通知
- ✅ **per-session 模式**：不产生 "All tasks" 汇总通知
- ✅ **per-session 模式**：支线失败同样分类为 `failed`
- ✅ **per-session 模式**：主线与支线通知行为一致
- ✅ **per-session 模式**：运行中途切换模式立即生效
- ✅ batch 模式：单个完成不响，全部完成才响
- ✅ batch 模式：新一波任务正确处理
- ✅ 主线逻辑：主线完成立即响
- ✅ 主线逻辑：主线不干扰支线判定
- ✅ 事件分类：completed vs failed（含相同错误消息连续失败）
- ✅ 边界情况：会话移除、预存在 idle、快速启停
- ✅ 交互事件：question / permission（含去重与静默基线）

**高级测试**（`mainline-sideline-advanced.test.ts`，21 个）：
- ✅ 运行中切换主线
- ✅ 多次标记主线（只有最新生效）
- ✅ 主线 ID 指向不存在会话
- ✅ 连续快速完成多个任务
- ✅ 交错启动/停止循环
- ✅ 主线导致"全部 idle"时抑制汇总
- ✅ 抑制仅限同一 observe() 调用
- ✅ 不设主线的纯支线 batch 模式兼容
- ✅ 失败事件检测保留
- ✅ 问题/权限交互保留
- ✅ 会话移除清理保留
- ✅ **per-session 模式走远程事件路径（observeStatus）逐个通知**
- ✅ **per-session 模式：最后一个任务完成时不产生汇总**
- ✅ **batch 模式在同一路径上仍然汇总**
- ✅ **同一会话二次运行再次通知**
- ✅ **移除会话后不产生通知**
- ✅ 20 个会话压力测试
- ✅ 快速切换主线 10 次

### 5.2 测试命令

```bash
# 运行全部测试
pnpm test

# 监听模式
pnpm test:watch

# 测试输出
✓ tests/engine.test.ts (27 tests)
✓ tests/mainline-sideline-advanced.test.ts (21 tests)
✓ tests/mainline-mode.test.ts (13 tests)
✓ tests/settings-normalize.test.ts (6 tests)
✓ tests/pending.test.ts (10 tests)
✓ tests/sound-params.test.ts (15 tests)

Test Files  6 passed (6)
Tests  92 passed (92)
```

---

## 六、非功能需求

### 6.1 性能要求

- Web Audio 音效合成耗时 < 50ms
- 状态边沿检测不阻塞 UI 渲染
- localStorage 读写即时（无防抖）
- Settle 窗口 100ms（避免状态抖动）

### 6.2 兼容性

- DSH 版本：≥ 0.1.6-alpha.1
- 浏览器：Chrome/Edge/Safari 最新两个大版本
- Notification API 和 Web Audio API 支持（现代浏览器标配）

### 6.3 可维护性

- 代码基于 TypeScript 严格模式
- 核心逻辑（Engine）与 UI 解耦，便于单元测试
- 92 个测试覆盖所有边界情况
- 清晰的职责分离：engine / sounds / notification / settings

---

## 七、开发计划

### Phase 1：MVP 实现（✅ 已完成）

- [x] 创建项目结构
- [x] 实现会话完成检测引擎（4 种事件类型）
- [x] 实现支线通知方式（per-session / batch 可切换）
- [x] 实现 ⭐ 主线标记（支持多个，composer + 会话「…」菜单）
- [x] 实现 3 种音效合成
- [x] 实现浏览器通知
- [x] 创建设置面板 UI
- [x] 添加中英文本地化
- [x] 编写 92 个单元测试（全部通过）
- [x] 编写 README.md 和 PRD

### Phase 2：打磨与发布（进行中）

- [ ] 本地测试验证（安装到 DSH Web）
- [ ] 收集用户反馈
- [ ] 优化 UI 细节
- [ ] npm 发布 `attention-plugins` 包
- [ ] 提交到社区插件目录（GitHub topic: `dsh-plugin`）

### Phase 3：功能扩展（未来）

详见 [`docs/vision.md`](./vision.md)

---

## 八、参考资料

- **灵感来源**：[@dingyi222666/dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification)
- **DSH 官方文档**：
  - Cordis Plugin 开发：`/Users/edy/Z-github/deepseek-harness/docs/cordis-primer.md`
  - Client Plugin 机制：源码 `packages/client/` 与 `packages/extensions/`

---

## 九、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| DSH 0.1.x alpha 接口变化 | 升级后插件失效 | 锁定依赖版本；在 README 标注版本兼容性 |
| 浏览器 autoplay 策略阻止声音 | 用户首次使用无声 | 在设置面板提供"测试音效"按钮引导交互 |
| Notification 权限被拒 | 浏览器通知不可用 | 在设置面板显示权限状态；提供浏览器设置引导 |
| 支线通知方式两种模式易混淆 | 用户理解成本 | 设置面板用单选 + 举例说明（响 N 次 vs 响 1 次），⭐ 按钮视觉直观 |

---

**文档版本**：v2.0  
**最后更新**：2025-01-XX  
**负责人**：用户  
**审批状态**：已确认
