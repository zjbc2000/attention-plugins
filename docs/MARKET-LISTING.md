# 目录物料 / Market listing kit

> **状态：草稿。待提 PR，不要直接推。**
> 本文件只准备 `awesome-dsh-plugin` 条目与配套物料；实际改动必须走 fork + PR，且由仓库 owner 确认后再提交。
> 核查时间：2026-11-04（UTC）。

## 背景：主分支条目还停在 v0.2.0

2026-11-04 抓取 `https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/data/plugins/zjbc2000__attention-plugins.yml`，`tarball` 仍指向 **v0.2.0**，描述还是 0.2.0 的两设置模型（支线 batch / 均衡）。

## 已提交的条目（v0.2.2）

分支：`zjbc2000/awesome-dsh-plugin:update/zjbc2000-attention-plugins-0.2.2`

```yaml
url: https://github.com/zjbc2000/attention-plugins
name: zjbc2000/attention-plugins
category: notify
icon: https://raw.githubusercontent.com/zjbc2000/attention-plugins/main/assets/icon.png
tarball: https://github.com/zjbc2000/attention-plugins/releases/download/v0.2.2/attention-plugins-0.2.2.tgz
description:
  en: 'Task-tiered session notifications for DSH: marked main-line sessions alert as they finish, other sessions batch into one summary, plus balanced and silent modes; per-event sounds or uploaded audio, per-session mute, click-through notifications, and an option to wait for subagents.'
  zh: "面向 DSH 的任务分级会话通知：标记的主线任务完成或失败时立即提醒，其余会话汇总为一声；另有逐条提醒的均衡模式与完全不响的静音模式（提问与权限请求仍提醒）。支持每类事件独立音效或自定义音频、按会话静音、点击通知直达会话，以及等待子代理结束再提醒。"
```

改动说明（PR 里只该有这些）：

- `tarball`：v0.2.0 → v0.2.2。
- 新增 `icon`：指向仓库内 `assets/icon.png`（512×512 铃铛图）。
- `description`：改成三档任务模式的说法，补上自定义音频、按会话静音、点击通知、等待子代理；不写「唯一」「最强」，不写 Star 请求。
- `category` 保持 `notify`；`url` 与 `name` 不变。
- 英文描述含 `: `，必须用单引号包住，否则 YAML 解析成嵌套键。

> 不要顺手改别人的条目，不要改 `data/` 以外的文件。

## 提交前 checklist

| 项目 | 现状 | 要求 / 动作 |
|---|---|---|
| icon | `assets/icon.png`（512×512）已随 PR 提交 | 方图、单色铃铛，缩到 64px 仍可辨 |
| screenshots | 仓库内有 7 张真实截图（`docs/images/shot-*.png` / `.gif`） | 目录的展示图由站点抓取，条目内不放截图字段 |
| 描述长度 | 本稿 `en` 约 270 字符、`zh` 约 105 字（现行条目 339 / 88） | 以实际渲染是否截断为准 |
| 版本一致性 | tarball 指 v0.2.2；npm 发布 0.2.2 后即一致 | 提 PR 前跑 `npm view attention-plugins version` |
| 分类 | `notify` | 不改 |
| tarball 可下载 | Release 创建后验证 | 浏览器点一次，确认 200 且文件名对得上 |
| 仓库链接可达 | `https://github.com/zjbc2000/attention-plugins` | 非 404 |
| issue labels | 模板引用 `install` / `sound` / `compatibility` / `enhancement` | 在 Settings → Labels 创建，否则新建 issue 会被拒 |

## 应补的 3 张截图（需真实截图，不得伪造）

通知类插件的价值是**时序体验**，设置面板截图传递不了「主线立刻响、支线攒着」。三张各对应一个时刻：

| # | 画面 | 必须能看出 | 建议文件名 |
|---|---|---|---|
| 1 | 主线即时提醒 | 3 个会话并行，其中 1 个标了主线；主线完成瞬间的提示音/通知（可截设置面板 + 通知气泡的组合，但必须有真实事件发生） | `docs/images/market-mainline-alert.png` |
| 2 | 支线静默 / 汇总 | batch 模式下的侧栏（支线在跑、没有弹提醒）与「全部结束」那一刻的单次汇总提醒 | `docs/images/market-batch-summary.png` |
| 3 | 提问权限卡片 | 会话里出现提问或权限请求时立即提醒的界面（含问题本身，不要暴露真实 token / 私有内容） | `docs/images/market-question-alert.png` |

拍摄要求：

- 用**真实运行**的 DSH + 真实完成事件，不用设置页摆拍、不合成；
- 抹掉 token、URL 里的会话参数、私有仓库名；
- 宽度 ≥ 1200px，PNG；暗色/亮色择一即可，三张保持同主题；
- 每张配一句 alt 文案（中文即可），说明「什么时刻、发生了什么」。

## icon 说明与导出

- `assets/icon.svg`：512×512 视口，铃铛本体 + 下方三条递减横杠（最宽 = 主线，其余 = 支线）；纯矢量、无文字、无外部引用，单色 `#111111`，反色时把该色替换为 `#FFFFFF`（或改为 `currentColor`）。
- `assets/icon.png`：512×512，已用 macOS `sips` 从 SVG 导出：

  ```bash
  sips -s format png assets/icon.svg --out assets/icon.png
  ```

  其它平台的等价命令：`rsvg-convert -w 512 -h 512 assets/icon.svg -o assets/icon.png`、`magick assets/icon.svg -resize 512x512 assets/icon.png`。

## 提 PR 的步骤（给 owner 用，不要脚本化推送）

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`（或直接在网页上 edit file 走自动 fork）；
2. 只改 `data/plugins/zjbc2000__attention-plugins.yml`，替换成本文的 YAML；
3. PR 标题建议：`chore: bump attention-plugins to v0.2.1`；描述里贴 v0.2.1 release 链接与「仅更新 tarball 版本与描述文案」；
4. 截图/icon 若目录本身不支持，则只用于 README 与 Release，不塞进 PR。

> 审核期间若已发新版本，先重开一次 checklist，不要用旧 tarball 混过审核。
