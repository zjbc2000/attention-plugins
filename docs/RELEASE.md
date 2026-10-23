# 发布与获客计划

> 目标：把 v0.2.0 发布到 DSH 社区目录，并让「任务分级通知」这个定位被目标用户看见。
>
> 现状（2026-10-23）：代码与测试已就绪（92 tests），版本已升到 0.2.0。**已决定保留现名 `attention-plugins`，不再改名。** npm 已发布（`attention-plugins@0.2.0`，2026-10-23），GitHub Release 预构建 tarball 保留作为国内网络环境的备选安装方式；目录条目已合并进 `awesome-dsh-plugin`，市场按「npm 优先、tarball 兜底」的规则会自动使用 npm 包。

## 0. 结论（TL;DR）

- **最终决定：保留 `attention-plugins`，不改名。** 理由：改名收益主要是搜索前缀，但会丢失已有的仓库/文档/设置命名空间一致性，而当前 0 star、目录未上架，靠目录收录与描述同样能获得曝光；等有下载量后再评估改名也来得及。
- **不要改名成 `dsh-attention`**：该名字已被 AnLifeX 的同类插件占用（`dsh-attention@0.4.1`，2026-08-21 创建，带桌面宠物和审批/提问通知，属于同一细分）。改名应避开这个前缀。
- **发布路径（实际执行）**：版本与元数据 → GitHub 推送/tag/Release（附预构建 `attention-plugins-0.2.0.tgz`）→ `awesome-dsh-plugin` 目录 PR（用 `tarball:` 字段）→ npm 发布 → 中文社区分发 → 两周复盘。
- **流量主通道**：DSH 内置市场 `dshmarket` 的目录（唯一市场）> npm 下载量排序 > GitHub topic/星标 > 社区内容。
- **定位**：不是「又一个通知插件」，而是**通知降噪 / 任务分级**——主线即时、支线汇总、均衡模式兜底。这是与现有通知插件最大的差异。

## 1. 命名决策

### 1.1 已被占用的名字（2026-10-22 查）

| npm 包 | 状态 | 说明 |
|---|---|---|
| `dsh-attention` | 已占用 | AnLifeX/dsh-attention，v0.4.1；审批/提问/完成通知 + 交互卡片 + 桌面宠物，同赛道 |
| `dsh-session-attention` | 已占用 | v0.3.0，会话提醒 + 悬浮球 |
| `dsh-session-notify` / `dsh-task-notify` / `dsh-notify-bell` / `dsh-notification` | 已占用 | 通知类竞品密集 |
| `dsh-notification-center`（`@lyhalal/...`） | 已占用 | 21 种音效、逐事件配置 |
| `dsh-focus` / `dsh-focus-notify` | 已占用 | 避免再往 `focus` 系列挤 |

### 1.2 可选名（当前免费）

| 名字 | 评价 |
|---|---|
| `dsh-mainline` **（推荐）** | 短、好记、独占「主线」概念；缺点是名字本身不说明「通知」，靠 description 补 |
| `dsh-mainline-notify` | 概念 + 功能都清楚，检索友好；缺点是偏长 |
| `dsh-priority-notify` | 直接描述「分级通知」，搜索友好；品牌感弱，且与现有 notify 系列相似 |
| `attention-plugins`（现名） | 零成本，保留现有安装与设置；npm 搜索偏弱，缺 `dsh-` 前缀 |
| `@zjbc2000/dsh-attention` | 兜底方案；scoped 包永远可用，但发现性最差 |

**不推荐** `dsh-attention-*` 系列：与已占用的 `dsh-attention` 名字过近，用户和目录审核都容易误判为同一插件/重复覆盖。

### 1.3 改名的成本（当前不执行，留作将来备选）

**本次决定不改名**，以下步骤仅在未来确实需要改名时使用。仓库 0 star、npm 未发布、目录未上架、本机只有一个 profile 引用 —— 改名只需要改 4 处 + 重装一次：

1. `package.json` 的 `name`、`repository`/`homepage`/`bugs`（如果同时改 GitHub 仓库名）。
2. `cordis.patch.yml` 的 `id` 与 `name`（必须与新包名一致）。
3. README / docs 中出现的包名与安装命令。
4. 本机 profile：先 remove 旧名，再 `add link:` 新名。

**设置命名空间保持 `attention-plugins` 不要改**：`localStorage` key（`attention-plugins:config`）和 host 侧 `settingsService.register('attention-plugins', ...)` 是用户配置的持久标识。改包名却保留存储 key，升级后设置不会丢；如果连 key 也改，需要额外写迁移，得不偿失。

GitHub 仓库改名后旧 URL 会自动 301，但请同步更新 `repository` 字段、README 徽章、目录 YAML 里的 `url`，并重新检查 `npm pack` 内容。

## 2. 发布前检查清单

### 代码与元数据

- [ ] `pnpm test`（92 tests）与 `pnpm run build` 通过；CI 绿。
- [ ] `package.json`：`name` 最终确定；`description` 一句话说清「分级通知」；`keywords` 含 `dsh-plugin`、`deepseek-harness`、`notification`、`mainline`；`engines.dsh` 与实际兼容范围一致（当前声明 `>=0.1.7`，在 0.2.1-rc.2 验证）。
- [ ] `LICENSE` 与 `author` 用真实署名（当前为 `zjbc2000`，如要用真名请替换）。
- [ ] `npm pack --dry-run` 确认 tarball 含 `lib/`、`cordis.patch.yml`、`README.md`、`LICENSE`（`lib/` 虽被 gitignore，但 `files` 白名单应把它打进包里——发布前务必实测）。
- [ ] 版本号：`0.1.2` → `0.2.0`（任务模式 + 多主线是 feature）；同步 CHANGELOG。
- [ ] `git diff --check` 无空白错误；工作区干净后再打 tag。

### 素材

- [ ] **真实截图** 2–3 张（设置面板、侧栏星标、两任务对比），不要用设计稿冒充。
- [ ] 仓库根加 `screenshots.json`（1–8 张，相对路径或 GitHub 托管 URL），目录卡片会自动展示。
- [ ] GitHub Social Preview（1280×640）在仓库 Settings 上传。
- [ ] README 顶部放 15–30 秒 GIF：标记主线 → 主线立即响 → 支线静默 → 全部结束汇总一声。

### 兼容与安装

- [ ] 干净 profile 用 **npm 包**（不是 `link:`）安装一次，确认 `dsh web` 能加载、设置页能打开。
- [ ] 用 `file:` 与 `link:` 各测一次更新流程（`link:` 改完 build 后刷新即可）。
- [ ] 确认 `dsh.bundle.patch` 指向的 `cordis.patch.yml` 在 tarball 内且路径正确。
- [ ] 旧配置迁移：从 0.1.x（单 `mainlineSessionId`）升级后标记仍在。

### 目录要求

- [ ] `dsh.bundle` manifest 存在（有）；仓库 ≥1 天（满足）；GitHub topic `dsh-plugin`（满足）。
- [ ] 仓库有真实代码（不是只有文档/占位）。
- [ ] 描述与实现一致，不写「最强/秒杀/唯一」这类营销词；目录会人工核查。
- [ ] 一个 PR 最多 3 个目录条目。

## 3. npm 发布

```bash
# 1) 定名与版本
#    改 package.json 的 name（如 dsh-mainline），再：
npm version 0.2.0 --no-git-tag-version
# 把 CHANGELOG 的 Unreleased 改为 0.2.0

# 2) 质量门（prepublishOnly 也会跑 test + build）
pnpm test && pnpm run build
npm pack --dry-run          # 关键：确认 lib/ 和 cordis.patch.yml 在包里
npm pack --dry-run 2>&1 | grep -E "lib/|cordis.patch.yml|README|LICENSE"

# 3) 发布（安全密钥型 2FA 账号的可行路径）
# npm 自 2025-09 起新账号只能用安全密钥，CLI 的浏览器认证回跳常报 /-/v1/done 404；
# 实测可行：网页创建一个勾选 Bypass two-factor authentication 的 granular token（Read and write），
npm config set //registry.npmjs.org/:_authToken=<token>
npm token list --json   # 确认 bypass_2fa: true
npm publish --access public

# 4) 验证
npm view <包名> version dist.tarball
```

发布后做一次**真实安装**验证：

```bash
dsh plugin --profile web remove <旧包名>
dsh plugin --profile web add <包名>@0.2.0
dsh web
```

> `dsh plugin` 只是 pnpm 的薄封装（`dsh plugin --profile web add ...`）。npm 包一旦可用，用户安装就变成一条命令，这是最影响转化的一步。

出问题时的回退：`npm deprecate <包名>@0.2.0 "reason"` 并尽快发 0.2.1；72 小时内可 unpublish，但不要依赖它。

## 4. GitHub 发布

```bash
git add -A
git commit -m "feat: v0.2.0 — task modes and multiple main-line markers"
git tag v0.2.0
git push origin main --tags
```

Release notes 模板：

```markdown
## attention-plugins v0.2.0

### Highlights
- 任务模式：主线模式 / 均衡模式
- 多主线标记：可同时标记多个会话，侧栏常驻星标
- README 重写、安装与兼容性说明修正

### Upgrade
- 旧配置的 `mainlineSessionId` 会自动迁移为 `mainlineSessionIds`
- 已安装用户：更新后刷新浏览器即可；npm 用户执行一次 add/upgrade

### Install
dsh plugin --profile web add <包名>
```

仓库设置：description 写「DSH 任务分级通知 / task-priority notifications」；topics 保留并补充 `mainline`、`task-management`、`web-audio`；开启 Discussions（可选）；发布页置顶；README 底部保留 Star CTA。

## 5. 目录上架（最重要的一步）

DSH 内置市场 `dshmarket`（1.68.0，目录 4200+ 插件）的数据来自 GitHub 精选列表 `awesome-dsh-plugin/awesome-dsh-plugin`，站点为 `awesome-dsh-plugin.com`，索引经 jsDelivr 分发。上架 = 给该仓库提一个 PR，只新增一个文件：

`data/plugins/<owner>__<repo>.yml`

```yaml
url: https://github.com/zjbc2000/attention-plugins
name: zjbc2000/attention-plugins
category: notify
description:
  en: Task-priority session notifications: main-line tasks alert immediately and side-line completions can be batched.
  zh: 任务分级通知：主线任务即时提醒，支线任务可汇总为一声，避免通知轰炸。
```

要点：

- `category` 用 `notify`（也可评估 `productivity`，但通知类目更精准）。
- 描述**一句话、准确、句号结尾**，不要营销词；en/zh 都要有。
- 不要手写 `npm:` 字段；包与仓库的对应关系由系统从 `repository` 自动采集。
- 文件名必须是 `<owner>__<repo>.yml`（注意双下划线）。
- 一个 PR 最多 3 条；提 PR 前先搜目录里有没有同名/同功能条目。

PR 标题与正文：

```
catalog: add zjbc2000/attention-plugins

- Task-priority notifications for DSH: main-line sessions alert immediately,
  side-line completions can be aggregated into one alert.
- Multiple main-line markers, switchable mainline/balanced mode, 4 event types,
  Web Audio sounds, bilingual settings UI.
- Source and install instructions in the repository README.
```

审核关注点：manifest 是否有效、仓库是否真实、描述是否与实现一致、是否与已有条目重复。**差异化写法很关键**：强调「分级/降噪」而不是「通知」——通知类目已经很挤，重复覆盖会被拒或排在后面。

合并后：

- 在 `dshmarket` 里搜包名/关键词，确认卡片、分类、截图、描述正确。
- 卡片截图优先来自 `screenshots.json`，没有再回退 README 图片；没有图的卡片点击率明显更低。
- 目录有 CDN 缓存，更新后等待缓存刷新再复核。

## 6. 提高流量的打法

### 6.1 一句话定位（所有渠道统一口径）

- 中文：**「DSH 任务太多，通知太吵？给任务分个主次：主线即时提醒，支线攒完再说。」**
- English: **"Task-priority notifications for DSH — only the tasks you care about interrupt you."**

对比角度（放在发布帖，不写进目录描述）：

| 常见通知插件 | attention-plugins |
|---|---|
| 每个任务完成都响，N 个任务 N 次打断 | 主线即时，支线可汇总成一声 |
| 只能全局开关 | 任务模式 + 支线策略 + 逐事件配置 |
| 通知是「更多」 | 通知是「更少、更准」 |

### 6.2 素材优先级

1. **GIF/短视频（最高优先级）**：15–30 秒，分镜：
   - 同时跑 3 个任务；
   - 把 A 标成主线（composer ☆）；
   - A 完成 → 立即响；
   - B 完成 → 静默；
   - 全部空闲 → 一声「All tasks」。
2. **截图**：设置面板全貌、侧栏星标、任务模式切换、per-session vs batch 对比。
3. **Social Preview**：标题 + 一句话 + 界面局部，1280×640。
4. **可复制的安装命令**：README 第一屏就能看到。

### 6.3 渠道与排期

| 优先级 | 渠道 | 动作 | 备注 |
|---|---|---|---|
| P0 | awesome-dsh-plugin | 目录 PR | 唯一市场入口，先确保审核通过 |
| P0 | npm | 发布 + 关键词优化 | 下载量影响市场排序 |
| P0 | GitHub | README/GIF/Release/topics | 搜索与信任的落点 |
| P1 | V2EX「分享创造」 | 中文长帖 + GIF | 开发者密度高，回复要快 |
| P1 | 即刻 / X | 短文案 + GIF + 安装命令 | 适合传播「降噪」叙事 |
| P1 | DSH 用户群 / 微信群 | 转发 + 求试用反馈 | 若有官方/社区群；不要刷屏 |
| P2 | 知乎 | 回答「DSH 插件推荐」类问题 | 长尾搜索流量 |
| P2 | B 站 / 小红书 | 30–60 秒演示视频 | 面向非硬核用户，强调「不被打断」 |
| P3 | Hacker News / Reddit | Show HN 英文版 | 受众匹配度一般，成本高 |

### 6.4 文案模板

**V2EX 标题**：`[分享] DSH 插件：给任务分主线/支线，只让重要的任务打断你`

**正文骨架**：

1. 痛点：同时开 5 个会话，完成通知变成噪音。
2. 做法：主线即时、支线汇总、均衡模式兜底；4 类事件、音效、浏览器通知。
3. GIF/截图。
4. 安装命令（一条）+ 兼容版本。
5. 求反馈：哪些场景还需要「安静」？欢迎提 issue。

**X/即刻**：

> 写了个 DSH 插件：任务分主线和支线。主线完成立刻提醒，支线攒到全部结束只响一声；不想分主次就开均衡模式，全部即时提醒。
> 4 类事件（完成/失败/提问/权限）+ 3 种音效 + 浏览器通知。
> `dsh plugin --profile web add <包名>`
> GitHub: <链接>

**知乎回答骨架**：先给结论（这个插件解决什么问题）→ 机制（主线/支线/均衡）→ 截图 → 安装 → 与「全量通知」的取舍 → 适合谁/不适合谁。

### 6.5 搜索与 SEO

- 仓库 description 同时包含中英文关键词：`DSH notification`、`mainline`、`side-line`、`task priority`、`通知降噪`。
- npm keywords 已覆盖 `dsh-plugin`、`deepseek-harness`、`notification`、`mainline`、`attention` 等；后续按下载来源补词。
- README 的 H2 用用户会搜的词：「通知规则」「设置项」「常见问题」「安装」。
- 目录 en/zh 描述都写「main-line / 支线 / 通知」，让两种语言的搜索都能命中。
- GitHub topics 控制在相关范围，别堆无关热词。

### 6.6 转化优化

- 安装一条命令；默认配置就能用（主线模式 + per-session）。
- 第一屏放 GIF + 一句话 + 安装命令，不要先讲架构。
- 明确兼容版本与「不支持」边界，减少安装失败。
- FAQ 覆盖：没声音、通知不弹、会不会重复响、配置存哪。
- Star CTA 只放在 README 底部/Release notes，不写进目录描述。

### 6.7 留存与口碑

- issue 24 小时内响应；把高频问题补进 FAQ。
- 每次发布写 CHANGELOG；版本语义清晰。
- 路线图公开，收集「每个会话单独静音」「通知历史」这类需求投票。
- 欢迎用户贴使用场景；真实案例比自夸更有说服力。
- 保持小而稳：宁可少功能，不要引入破坏性兼容问题。

### 6.8 指标

| 指标 | 查看方式 | 首月目标（方向性） |
|---|---|---|
| npm 周下载 | `https://api.npmjs.org/downloads/point/last-week/<包名>` | 100–300 |
| GitHub stars | 仓库页 / API | 20–50 |
| GitHub 流量 | Insights → Traffic（views/clones/referrers） | 持续有外部 referrer |
| 目录排名 | dshmarket 按 stars/downloads 排序 | 进入 notify 类目前列 |
| issue/反馈 | GitHub issues | 至少 3 条真实反馈 |

数字只是方向，别为了 KPI 刷量；通知类目竞争激烈，精准定位比总量更重要。

### 6.9 风险与对策

| 风险 | 对策 |
|---|---|
| 撞名 `dsh-attention` | 用 `dsh-mainline` / `dsh-mainline-notify`，远离 attention 前缀 |
| 目录判重复 | 描述强调「分级/汇总」而非泛通知；一个 PR 只提 1 条 |
| 用户觉得「漏通知」 | 文档写清 batch 模式会汇总支线失败；后续加「支线失败立即提醒」选项 |
| DSH 版本 API 变动 | 声明 `engines.dsh`，锁 peer range，发布前在最新 rc 上跑一遍 |
| 维护成本 | 控制范围：先做好通知分级，不急着加桌面宠物/宠物互动等重功能 |

## 7. 两周节奏

| 时间 | 动作 |
|---|---|
| D-3 | 定名；改 package/patch/README；跑测试与 build；拍截图/GIF；写 screenshots.json |
| D-2 | 干净 profile 用 npm 包彩排安装；修安装问题；准备 Release notes |
| D-1 | 全量回归；确认目录 YAML；准备社区文案 |
| D0 | npm 发布 → GitHub tag/Release → 目录 PR → V2EX/即刻/X |
| D+1 | 回复评论/issue；知乎回答；发 B 站/小红书（如做视频） |
| D+3 | 看 npm 下载、stars、referrers；修高频问题；发 0.2.1（如需） |
| D+7 | 复盘渠道转化；调整目录描述/截图；规划 0.3 |
| D+14 | 决定是否投入更多渠道；沉淀用户案例 |

## 8. 复盘模板

```markdown
## 发布复盘 v0.2.0

- 渠道 → 访问/下载/star：目录 / V2EX / X / 知乎 / 其他
- 转化：GitHub 访问 → star；npm 下载 → 实际安装反馈
- 有效文案/素材：
- 失败或低效的渠道：
- 用户最关心的 3 个问题：
- 下一步（0.2.1 / 0.3）：
```

## 9. 参考

- 目录仓库：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>
- 市场：`dshmarket`（`dsh plugin --profile web add dshmarket`）
- 本仓库：<https://github.com/zjbc2000/attention-plugins>

## 10. 执行记录（2026-10-22）

| 动作 | 状态 | 地址 / 说明 |
|---|---|---|
| git commit + push | ✅ | `d2bbdbf`，main 分支 |
| tag + GitHub Release | ✅ | <https://github.com/zjbc2000/attention-plugins/releases/tag/v0.2.0> |
| 预构建 tarball | ✅ | <https://github.com/zjbc2000/attention-plugins/releases/download/v0.2.0/attention-plugins-0.2.0.tgz>（已用 `dsh plugin add` 实测安装成功） |
| 仓库 CI | ✅ | GitHub Actions `CI` 绿色（Node 22 + pnpm 11） |
| 目录 PR | ✅ 已合并 | <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/8802>（条目 `data/plugins/zjbc2000__attention-plugins.yml`，category `notify`） |
| npm 发布 | ✅ | `attention-plugins@0.2.0`（2026-10-23 发布，用 granular token + bypass 2FA 完成） |
| 本机 web profile | ✅ | `link:` 安装已指向新构建，已 touch `cordis.patch.yml` 触发 HMR |

拿到目录流量后的下一步：按 §6.4 的文案发 V2EX「分享创造」与即刻/X；README 安装命令已切换为 `dsh plugin --profile web add attention-plugins`；目录条目仍待补 `icon:` / `screenshots.json`（需要真实截图）。
