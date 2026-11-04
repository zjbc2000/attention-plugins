# 截图流程 / Screenshot pipeline

README 里的截图不是设计稿，也不是拼贴：它们来自一个**隔离的 DSH 实例**加上**无头 Chrome**的真实渲染。
工具是仓库自带的 `scripts/shots.mjs`——它直接讲 Chrome DevTools Protocol，**不依赖 Playwright / Puppeteer**，
只需要 Node ≥ 22（内置 `WebSocket`）和一个 Chrome/Chromium 可执行文件。

## 为什么这么写

- 项目不装浏览器自动化依赖：`pnpm install` 不该为了几张图拉进一个几百 MB 的浏览器。
- `launch` 模式自带隔离：临时 `DSH_HOME` + `link:` 安装 + 随机端口，跑完删除，不碰真实 `~/.dsh`。
- 脚本本身就是验证工具：`eval` 读 DOM 文案、`click` 走真实指针事件、`shot` 按选择器或整页截图，
  顺手就能确认"这版 UI 真的渲染成这样"。

## 三步用法

```bash
# 1. 起隔离实例（打印 GUI URL、CDP 端口、临时 DSH_HOME，然后前台等待）
pnpm run shots -- launch

# 2. 另开一个终端，像这样驱动它
pnpm run shots -- --port 9333 eval 'document.title'
pnpm run shots -- --port 9333 shot docs/images/out.png --selector '.attention-meta' --dpr 2
pnpm run shots -- --port 9333 click 140 406

# 3. Ctrl-C：杀进程、删临时 DSH_HOME 与 Chrome profile（--keep 可保留排查）
```

`launch` 的可选项：

| 参数 | 作用 |
|---|---|
| `--chrome <path>` | 指定浏览器；不传则依次找系统 Chrome / Chromium |
| `--cdp-port <port>` | CDP 端口，默认 9333 |
| `--dsh-port <port>` | DSH GUI 端口，默认 0（随机） |
| `--keep` | 退出时保留临时目录，便于事后查看日志 |

`shot` 的取图方式：

| 参数 | 作用 |
|---|---|
| `--selector <css>` | 只截这个元素的外接矩形（CSS px，输出像素 = CSS × DPR） |
| `--full` | 截整页（`Page.getLayoutMetrics` 的 contentSize） |
| `--dpr 2` | 2 倍图，文字锐利，适合 README |

## 拍设置面板时的两个坑

1. **菜单是 hover 出来的**：`click` 先发 `mouseMoved` 再按下抬起；若个别菜单仍不展开，用
   `eval` 里的 `element.click()` 兜底。
2. **新 profile 里只有空白会话，会话行「…」菜单不出现**：先用实例自己的 RPC 建两个真实会话
   （`/api/session/create`、`rename`、`prompt`），再点菜单。
3. **长面板要分段**：设置页比视口高，滚动到多个 `scrollTop` 各截一张，再用 PIL 按 DPR 拼接；
   不要用 `--full` 硬截，长页里有的区块是虚拟滚动的。

## 现有产物

| 文件 | 说明 |
|---|---|
| `shot-settings-attention-full.png` | 设置面板全貌（4 段滚动的真实切片拼接） |
| `shot-meta-bar.png` | 信息栏：版本 / GitHub / 问题反馈 / 检查更新 |
| `shot-current-session-mode.png` | 当前会话三档 + 等待子代理结束 |
| `shot-custom-audio.png` | 每类事件的自定义音频行 |
| `shot-task-modes.png` | 任务模式三档单选区（含静音档说明） |
| `shot-mainline-entry.png` | 会话行「…」菜单（设为主线任务 / 静音此会话） |
| `shot-attention-loop.gif` | 3.8 s 主线标记循环（ffmpeg 由真实帧合成） |

重新生成时**不要覆盖** `settings-sounds-and-events.png`、`settings-task-mode.png`（0.1.x 时期的历史图）。
