# 兼容性矩阵 / Compatibility Matrix

> 原则：**只写验证过的组合；没跑过的写「未验证」，并说明缺哪一步。** 不写「理论上可以」，不把第三方目录的历史记录当作本版本的通过证明。
> 建档：2026-11-04（UTC）

## 矩阵

| 插件版本 | DSH 版本 | 验证方式 | 结论 | 证据链接 |
|---|---|---|---|---|
| 0.2.1 | 0.2.1-rc.2 | 作者开发与验证环境（端到端） | **已验证**（作者环境） | [README](../README.md) 顶部徽章 `DSH tested 0.2.1-rc.2`；README「安装」一节写「开发与验证环境为 0.2.1-rc.2」 |
| 0.2.1 | 0.1.7 至 0.2.1-rc.1（含 0.1.7、0.2.0-rc.1） | 仅 `engines.dsh >=0.1.7` 声明，未逐版运行 | **未验证** | [`package.json` `engines.dsh`](../package.json#L48) |
| 0.2.2 | 0.2.1-rc.4 | 本地 tarball（`npm pack`）安装到临时 `DSH_HOME` + composed profile 断言，`scripts/smoke-install.sh --pkg ./attention-plugins-0.2.2.tgz`（2026-11-04T09:12Z 实际跑通，退出码 0）；**未触发 UI 完成事件** | **安装层通过**（按本文标准不算端到端） | [scripts/smoke-install.sh](../scripts/smoke-install.sh) |
| 0.2.1 | 0.2.1-rc.4 | 本地安装到临时 `DSH_HOME` + composed profile 断言（2026-11-04，`scripts/smoke-install.sh` 同款步骤），**未触发 UI 完成事件** | **未验证**（安装层通过，按本文标准不算端到端通过） | [scripts/smoke-install.sh](../scripts/smoke-install.sh) |
| 0.2.1 | < 0.1.7 | 未测试；README 说明更早版本的会话 store API 已不适用 | **未验证**（预期不可用） | [README](../README.md) 安装要求：「更早版本的会话 store API 已不适用」 |
| 0.2.0 | 0.1.7-rc.2 / 0.2.0-rc.1 | 第三方目录历史记录曾写「沙箱安装通过、Web 启动冒烟失败」，**记录未标注被测工件版本** | **未验证**（该记录不可归因到 0.2.1） | `docs/RELEASE.md`；调研报告 §3-B8 |

**`engines.dsh` 是包管理器层面的声明，不是测试结论。** `>=0.1.7` 只表示作者认为该区间可用，除 0.2.1-rc.2 外没有逐版验证记录。

## 如何自行验证

最小步骤，全程不污染你真实的 `~/.dsh`（除第 4 步的界面操作外）：

1. **准备隔离环境**（可跳过，直接跑仓库脚本）：

   ```bash
   export DSH_HOME="$(mktemp -d)"     # 之后所有 dsh 命令只读写这个临时目录
   echo "$DSH_HOME"
   ```

   或者直接执行仓库里的冒烟脚本，它自带 `mktemp -d`、断言与清理：

   ```bash
   bash scripts/smoke-install.sh          # 先看会执行什么：bash scripts/smoke-install.sh --dry-run
   ```

2. **从 npm 安装到临时 profile**：

   ```bash
   dsh plugin --profile web add attention-plugins
   ```

   预期：`profiles/web/package.json` 的 `dependencies` 出现 `attention-plugins`，且 `dsh.profile.bundles` 末尾追加同名条目。

3. **确认插件进入 profile bundle（非交互）**：

   ```bash
   dsh --profile web --dump-config | grep -A2 '^# == attention-plugins'
   ```

   预期输出包含：

   ```
   # == attention-plugins
   - id: attention-plugins
     name: attention-plugins
   ```

4. **启动并触发一次真实事件**：

   ```bash
   dsh web        # 用你自己的 profile 时才会影响真实环境
   ```

   - 打开 **Settings → Attention**，确认面板显示版本 `0.2.1`；
   - **先点一次 ▶ 试听**（浏览器要求音频必须由用户手势解锁，不点试听就没声音是预期行为）；
   - 标记一个会话为**主线**；
   - 跑一个能在几十秒内结束的任务（例如让它回答一句话），等待完成事件。

5. **记录结果**：DSH 版本（`dsh --version`）、插件版本、上面用过的命令、是否听到声音、是否收到浏览器通知、截图；然后往本文矩阵里加一行，或在 issue 里贴这份记录。

## 判定标准（什么才算「已验证」）

一条组合要记为「已验证」，必须同时满足：

- [ ] 空 profile（或临时 `DSH_HOME`）里 `dsh plugin --profile web add attention-plugins` 成功；
- [ ] `dsh --profile web --dump-config` 中出现 `attention-plugins` 条目；
- [ ] `dsh web` 启动后 **Settings → Attention** 面板可见、版本号正确；
- [ ] 点过 ▶ 试听后，一次真实完成事件能听到声音（或收到浏览器通知）；
- [ ] 记录里有 DSH 版本 + 插件版本 + 命令 + 结果。

只完成前两步的，记为「安装层通过」，不要写成「兼容」。

## 已知会让验证失败的前置条件（不是 bug）

- **没有声音**：浏览器要求先有用户手势才能播放音频；没点 ▶ 试听时首次自动播放会被拦。
- **没有浏览器通知**：系统/浏览器通知权限未授予，或页面在前台（默认只在后台标签页弹）。
- **batch 模式下支线失败不单独响**：会并入「全部结束」的汇总，这是设计行为。
