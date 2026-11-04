# 度量台账 / Metrics Ledger

> 用途：把每一个对外引用过的下载/Star 数字**连同它的口径**一起留档，使任何人能据此复算，而不是二次转述。
> 建档：2026-11-04（UTC）｜维护：每次发布或每周至少一次｜单位：次 / 个
> 数据来源仅限：npm 官方统计 API、GitHub 官方 API、第三方目录页面（只记录其展示值）。

## 为什么不能把不同口径的数字混用

- **npm 下载不是用户数。** 官方说明下载数由 registry raw logs 按日聚合，计的是 tarball 的 HTTP 200 响应，可能包含 CI、镜像与机器人，官方称之为「方向性的流行度指标」。
- **第三方目录的 downloads 是「市场声明」。** DSH 官方文档说明市场索引未签名，`downloads`/`ratings` 属于市场自定义字段，DSH 只按格式展示、不解释语义；同一插件在不同目录可以是 386 / 434 / 719 / 778，全部「没错」，只是口径不同。
- **四个已核实数字的窗口与数据源各不相同**：386 是 npm 官方 7 个完整日（2026-10-27..11-02）；778 是某目录的「近 30 天」，采样日与统计方法页面未说明；434 / 719 是周/累计，且为 npm 官方 + npmmirror 合并；0 是 GitHub 某一时刻的 `stargazers_count`。
- **因此它们不能相加、不能相减、不能互相印证**（「778 − 374 = 404 个新用户」是错误推理：滚动窗口下净增 = 新增 − 滚出，且 374 来源未知）。
- **Star 与下载来自两个系统里的两个动作**：安装 npm 包不会产生 Star，Star 需要在仓库页主动点击；两者之间没有换算关系。
- **只用本表内、同一行、已注明窗口的数字做比较**；跨行比较前先确认窗口与数据源一致，否则在备注里写明「口径不同，不可比」。
- **拿不到就写「未取」，不要填 0**；0 是「查询到确实为 0」（如本项目 Stars），空白是「没查」。

## 已核实的基准（2026-11-04 抓取）

| 口径 | 值 | 窗口 / 采样 | 来源 | 能否当「用户数」 |
|---|---|---|---|---|
| npm 官方 7 日下载 | **386** | 2026-10-27 至 2026-11-02（7 个完整日） | <https://api.npmjs.org/downloads/point/last-week/attention-plugins> | 否 |
| 第三方目录展示值 | **778** | 「近 30 天」；采样日与统计方法页面未说明 | <https://awesome-dsh-plugin.com/zh/p/zjbc2000/attention-plugins/> | 否 |
| 第三方目录展示值 | **434**（周）/ **719**（累计） | 周 / 累计；npm 官方 + npmmirror 合并，镜像窗口约新 5 天 | <https://www.dsh.so/artifact/attention-plugins/> | 否 |
| GitHub Stars | **0** | 查询时刻快照（2026-11-04） | <https://api.github.com/repos/zjbc2000/attention-plugins> | 是 Star 数，不是用户数 |

补充已核实事实（同次抓取，供解读上表时对照）：

- npm 最新版 `0.2.1`；0.2.0 发布于 2026-10-23 01:08 UTC，0.2.1 发布于 2026-10-28 08:09 UTC。
- 10-28（发布日）单日下载 **199**，占该周 386 的 **51.6%**——这是时间相关，不是「发布带来 199 个用户」的归因。
- GitHub 仓库 public、非 fork、MIT，创建 2026-09-21，最后推送 2026-10-28；Stars / Forks / Open issues = 0 / 0 / 0。
- 目录收录：`awesome-dsh-plugin` PR #8802，2026-10-22 合并，category `notify`。
- **374 不进本表**：仅用户口述，页面、日期、窗口均未确认，不可作为基准。

## 每日台账

填写规则：日期一律 UTC；`npm 7日` 必须写窗口（`last-week` 即截至抓取日的前 7 个完整日）；`目录展示值` 必须注明是哪个目录、什么窗口，多个目录分行或用 `<br>` 分隔；同一格内禁止混入不同数据源合计。

| 日期(UTC) | 来源URL | 包版本 | npm 7日 | 目录展示值(注明窗口) | GitHub Stars | 备注 |
|---|---|---|---|---|---|---|
| 2026-11-04 | <https://api.npmjs.org/downloads/point/last-week/attention-plugins><br><https://awesome-dsh-plugin.com/zh/p/zjbc2000/attention-plugins/><br><https://www.dsh.so/artifact/attention-plugins/><br><https://api.github.com/repos/zjbc2000/attention-plugins> | 0.2.1 | 386（2026-10-27..11-02） | 778（近 30 天，awesome-dsh-plugin.com，方法未说明）<br>434 周 / 719 累计（dsh.so，npm+npmmirror 合并） | 0 | 建档首行；发布日 10-28 单日 199 占该周 51.6%；Open issues 0；374 来源未知，未采信 |
| 2026-11-05 |  |  |  |  |  |  |
| 2026-11-06 |  |  |  |  |  |  |
| 2026-11-07 |  |  |  |  |  |  |
| 2026-11-08 |  |  |  |  |  |  |
| 2026-11-09 |  |  |  |  |  |  |
| 2026-11-10 |  |  |  |  |  |  |
| 2026-11-11 |  |  |  |  |  |  |

### 复算命令（照抄即可）

```bash
# npm 官方 7 日总量与逐日
curl -fsS https://api.npmjs.org/downloads/point/last-week/attention-plugins
curl -fsS https://api.npmjs.org/downloads/range/last-week/attention-plugins

# npm 最新版本与发布时间
curl -fsS https://registry.npmjs.org/attention-plugins | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j["dist-tags"].latest, j.time[j["dist-tags"].latest])})'

# GitHub Stars / Forks / Open issues（需 gh 已登录）
gh api repos/zjbc2000/attention-plugins --jq '{stars:.stargazers_count,forks:.forks_count,open_issues:.open_issues_count}'

# 第三方目录（只记录页面展示值，不要当作 npm 官方数）
curl -fsSL https://awesome-dsh-plugin.com/zh/p/zjbc2000/attention-plugins/ | grep -o '近 30 天[^<]*' | head
```

## 四周观察指标（观察窗：2026-11-04 起 4 周）

| 指标 | 采集方式 | 2026-11-04 基线 | 说明 |
|---|---|---|---|
| 新增 Star | 每日 `stargazers_count` 差值与 `gh api .../stargazers` 时间线 | 0 | 记增量，不记累计比值 |
| 周下载趋势 | 每周同一天的 `last-week`，逐周并列 | 386 | 只看趋势；发布日峰值单独标注 |
| GitHub 页面访问（views / unique visitors / clones / referrers） | 仓库 Insights → Traffic（**需 repo 权限**，公开 API 拿不到） | 未取 | 只有 owner 能取；取不到就写「未取」 |
| 安装失败 issue 数 | `.github/ISSUE_TEMPLATE/01-install-failed.yml` 的 issue 计数 | 0 | 按周计数，标明窗口 |
| 真实反馈条数 | 有具体环境/复现步骤的 issue + 明确的使用反馈（非 Star、非下载） | 0 | 只有「装了并用起来」的反馈才算 |

**明确不使用 Star / 下载比。** 理由：分子（GitHub 上的一次主动点击）与分母（npm 按日聚合的 tarball 200 响应，含 CI、镜像、机器人）来自不同系统、不同单位、不同时间尺度，比值不衡量任何真实转化，还会随镜像抓取抖动。

> 指标只用于观察方向，不设「必须达到 X」的硬目标；任何引用本表数字的对外文案，都必须同时写出窗口与来源。
