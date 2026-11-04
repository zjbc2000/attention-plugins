#!/usr/bin/env bash
#
# 用途 / Purpose
#   attention-plugins 的可复现安装冒烟：在一个**临时 DSH_HOME**（mktemp -d）里
#   从 npm 安装本插件，再用非交互的 `dsh --profile web --dump-config` 断言插件
#   条目确实进入了 profile bundle，最后清理临时目录。不会碰你真实的 ~/.dsh，
#   不需要 sudo，也不会启动常驻的 `dsh web`。
#
#   可复现安装冒烟 / reproducible install smoke test for attention-plugins:
#   installs into a throwaway DSH_HOME, asserts the plugin landed in the composed
#   web profile, and removes the temp home on exit. Your real profile is never
#   touched. The interactive UI check (sound / notification) is manual and lives
#   in docs/COMPATIBILITY.md.
#
# 用法 / Usage
#   bash scripts/smoke-install.sh [options]
#
#   --dry-run         只做前置检查并打印将要执行的命令，不创建临时目录、不安装
#   --keep            结束后保留临时 DSH_HOME（排查失败用），并打印其路径
#   --pkg <spec>      指定安装目标，默认 attention-plugins。可写版本
#                     （attention-plugins@0.2.2）、本地 tarball（npm pack 产物）
#                     或目录；本地路径会跳过 registry 预检。
#   -h, --help        显示本帮助
#
#   环境变量：
#     DSH_SMOKE_TIMEOUT  单步超时秒数（默认 300，0 表示不限制）
#     NPM_CONFIG_REGISTRY / npm 配置会影响实际下载源；本脚本只检查默认 registry 可达性
#
# 退出码 / Exit codes
#   0   通过：安装成功且插件条目出现在 composed profile 中
#   2   用法错误（未知参数 / 缺少参数值）
#   10  缺少前置条件（dsh / pnpm / node 不在 PATH，或不可执行）
#   11  网络不可达（registry.npmjs.org 探测失败）
#   12  安装失败（dsh plugin ... add 非零退出）
#   13  profile 断言失败（profiles/web/package.json 里没有依赖或 bundle 条目）
#   14  dump-config 失败或输出中没有插件条目（含超时）
#   20  无法创建临时目录（mktemp 失败）
#
set -euo pipefail

PKG_SPEC="attention-plugins"
DRY_RUN=0
KEEP=0
TIMEOUT_S="${DSH_SMOKE_TIMEOUT:-300}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TMP_DIR=""
PROFILE_DIR=""
LOG_DIR=""
STEP_FAILED=0

# ---------- 输出 ----------
if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_OFF=$'\033[0m'
else
  C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_OFF=""
fi

log()  { printf '%s\n' "$*"; }
info() { printf '%s==>%s %s\n' "$C_DIM" "$C_OFF" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
err()  { printf '%sx%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; }

usage() {
  sed -n '3,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# ---------- 清理 ----------
cleanup() {
  local rc=$?
  trap - EXIT HUP INT TERM
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    if [ "$KEEP" -eq 1 ]; then
      warn "保留临时 DSH_HOME：$TMP_DIR"
    else
      rm -rf "$TMP_DIR" 2>/dev/null || warn "临时目录清理失败，请手动删除：$TMP_DIR"
    fi
  fi
  exit "$rc"
}

# ---------- 参数 ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --keep) KEEP=1 ;;
    --pkg)
      shift
      [ $# -gt 0 ] || { err "--pkg 需要一个参数"; exit 2; }
      PKG_SPEC="$1"
      ;;
    --pkg=*) PKG_SPEC="${1#--pkg=}" ;;
    -h|--help) usage; exit 0 ;;
    *) err "未知参数：$1（用 --help 查看用法）"; exit 2 ;;
  esac
  shift
done

case "$TIMEOUT_S" in
  ''|*[!0-9]*) err "DSH_SMOKE_TIMEOUT 必须是整数秒：$TIMEOUT_S"; exit 2 ;;
esac

# A local tarball (npm pack output) or a directory is installable too:
# there is nothing to look up on the registry, so the probe is skipped.
LOCAL_PKG=0
LOCAL_PATH=""
case "$PKG_SPEC" in
  /*|./*|../*|link:*|file:*)
    LOCAL_PATH="${PKG_SPEC#link:}"
    LOCAL_PATH="${LOCAL_PATH#file:}"
    [ -e "$LOCAL_PATH" ] && LOCAL_PKG=1
    ;;
esac

PKG_NAME="$PKG_SPEC"
case "$PKG_SPEC" in
  @*/*@*) PKG_NAME="${PKG_SPEC%@*}" ;;
  @*) ;;
  *@*) PKG_NAME="${PKG_SPEC%@*}" ;;
esac
if [ "$LOCAL_PKG" -eq 1 ]; then
  PKG_NAME="attention-plugins"
fi

# ---------- 超时执行（macOS 无 timeout(1)，用 perl alarm 兜底） ----------
TIMEOUT_PREFIX=()
if command -v perl >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(perl -e 'alarm shift; exec @ARGV')
elif command -v timeout >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(timeout)
fi

run_limited() { # run_limited <seconds> <cmd...>
  local secs="$1"; shift
  if [ "$secs" -le 0 ] || [ ${#TIMEOUT_PREFIX[@]} -eq 0 ]; then
    "$@"
    return $?
  fi
  "${TIMEOUT_PREFIX[@]}" "$secs" "$@"
}

print_tail() { # print_tail <file> [lines]
  local file="$1" n="${2:-40}"
  if [ -s "$file" ]; then
    printf '%s\n' "$C_DIM" >&2
    tail -n "$n" "$file" | sed 's/^/    /' >&2
    printf '%s\n' "$C_OFF" >&2
  else
    err "（该步骤没有输出）"
  fi
}

die_step() { # die_step <exit-code> <title> <logfile> <command-string> <rc>
  local code="$1" title="$2" logfile="$3" cmd="$4" rc="$5"
  err "失败：$title"
  err "命令：$cmd"
  err "退出码：$rc"
  if [ "$rc" -eq 142 ] || [ "$rc" -eq 124 ]; then
    err "原因：超时（${TIMEOUT_S}s）。可用 DSH_SMOKE_TIMEOUT=0 关闭限制后重试。"
  fi
  err "输出尾部（最后 40 行）："
  print_tail "$logfile" 40
  if [ -n "$LOG_DIR" ] && [ -d "$LOG_DIR" ]; then
    err "完整日志：${LOG_DIR}（加 --keep 可保留，否则退出时随临时目录删除）"
  fi
  exit "$code"
}

run_step() { # run_step <exit-code> <title> <logname> <cmd...>
  local code="$1" title="$2" logname="$3"; shift 3
  local logfile="$LOG_DIR/$logname.log"
  local cmd_str="$*"
  local rc=0
  info "$title"
  log "  $ $cmd_str"
  run_limited "$TIMEOUT_S" "$@" >"$logfile" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    die_step "$code" "$title" "$logfile" "$cmd_str" "$rc"
  fi
}

# ---------- 前置检查 ----------
preflight() {
  local missing=0

  if ! command -v dsh >/dev/null 2>&1; then
    err "找不到 dsh。请先安装 DeepSeek Harness，并确认它在 PATH 中："
    err "  npm i -g @deepseek-ai/dsh    （或按官方文档安装）"
    missing=1
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    err "找不到 pnpm。\`dsh plugin add\` 会把参数转发给 profile 目录里的 pnpm："
    err "  npm i -g pnpm"
    missing=1
  fi
  if ! command -v node >/dev/null 2>&1; then
    err "找不到 node（DSH 与断言都需要）：https://nodejs.org/"
    missing=1
  fi
  [ "$missing" -eq 0 ] || exit 10

  if [ "$LOCAL_PKG" -eq 1 ]; then
    info "本地包：${PKG_SPEC}（跳过 registry 预检）"
  elif command -v curl >/dev/null 2>&1; then
    info "检查 registry.npmjs.org 可达性"
    if ! curl -fsS --max-time 15 -o /dev/null "https://registry.npmjs.org/${PKG_NAME}"; then
      err "访问 https://registry.npmjs.org/${PKG_NAME} 失败（网络不可达或需要代理）。"
      err "排查建议："
      err "  1) 确认能打开 https://registry.npmjs.org/${PKG_NAME}"
      err "  2) 若使用镜像：export npm_config_registry=https://registry.npmmirror.com 后重试"
      err "  3) 若使用代理：确认 HTTPS_PROXY 已导出且被 curl/pnpm 继承"
      exit 11
    fi
    ok "registry 可达"
  else
    warn "没有 curl，跳过网络预检（安装步骤仍会暴露网络错误）"
  fi

  info "dsh 版本：$(dsh --version 2>&1 | head -1)"
}

# ---------- 主流程 ----------
info "attention-plugins 安装冒烟（临时 DSH_HOME）"
log "  包：$PKG_SPEC"
log "  仓库：$REPO_DIR"
if [ -n "${DSH_HOME:-}" ]; then
  case "$DSH_HOME" in
    "$HOME/.dsh"|"$HOME/.dsh/"*)
      warn "检测到 DSH_HOME=${DSH_HOME}（真实 profile）；本次运行会整体覆盖为临时目录，不会写入它。"
      ;;
    *)
      warn "已忽略外部 DSH_HOME=${DSH_HOME}，本次使用新的临时目录"
      ;;
  esac
fi

preflight

if [ "$DRY_RUN" -eq 1 ]; then
  log ""
  ok "dry-run：前置检查通过，未创建临时目录、未安装、未写入任何 profile。"
  log ""
  log "将要执行的步骤："
  log "  1. TMP_DIR=\$(mktemp -d)  →  export DSH_HOME=\$TMP_DIR"
  log "  2. dsh plugin --profile web add $PKG_SPEC"
  log "  3. 断言 \$TMP_DIR/profiles/web/package.json："
  log "       dependencies.$PKG_NAME 存在，且 dsh.profile.bundles 含 $PKG_NAME"
  log "  4. dsh --profile web --dump-config | 断言存在 '- id: ${PKG_NAME}'"
  log "  5. 删除 \${TMP_DIR}（除非 --keep）"
  log ""
  log "真实运行：bash scripts/smoke-install.sh"
  log "交互层验证（声音/通知）请按 docs/COMPATIBILITY.md 手动执行。"
  exit 0
fi

TMP_ROOT="${TMPDIR:-/tmp}"
TMP_ROOT="${TMP_ROOT%/}"
TMP_DIR="$(mktemp -d "$TMP_ROOT/attention-plugins-smoke.XXXXXX")" || {
  err "mktemp 失败，无法创建临时目录"; exit 20
}
LOG_DIR="$TMP_DIR/logs"
mkdir -p "$LOG_DIR"
PROFILE_DIR="$TMP_DIR/profiles/web"

trap cleanup EXIT HUP INT TERM

export DSH_HOME="$TMP_DIR"
export npm_config_yes="${npm_config_yes:-true}"
ok "临时 DSH_HOME：$DSH_HOME"

run_step 12 "安装 $PKG_SPEC 到临时 profile" "install" \
  dsh plugin --profile web add "$PKG_SPEC"

# 断言 1：profile 的 package.json
info "断言 profile package.json"
PROFILE_JSON="$PROFILE_DIR/package.json"
if [ ! -f "$PROFILE_JSON" ]; then
  err "找不到 $PROFILE_JSON —— 安装没有按预期初始化 profile"
  err "目录内容："
  ls -la "$PROFILE_DIR" >&2 2>/dev/null || true
  exit 13
fi

set +e
PROFILE_JSON="$PROFILE_JSON" PKG_NAME="$PKG_NAME" node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.env.PROFILE_JSON, 'utf8'));
const name = process.env.PKG_NAME;
const deps = (pkg.dependencies || {});
const bundles = ((pkg.dsh || {}).profile || {}).bundles || [];
const problems = [];
if (!deps[name]) problems.push(`dependencies 缺少 ${name}（实际：${Object.keys(deps).join(', ') || '空'}）`);
if (!bundles.includes(name)) problems.push(`dsh.profile.bundles 缺少 ${name}（实际：${bundles.join(', ') || '空'}）`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`dependencies.${name} = ${deps[name]}`);
console.log(`bundles 含 ${name}（共 ${bundles.length} 个）`);
NODE
ASSERT_RC=$?
set -e
if [ "$ASSERT_RC" -ne 0 ]; then
  err "失败：profile 断言（profiles/web/package.json 未包含插件）"
  err "文件：$PROFILE_JSON"
  err "内容尾部："
  tail -n 40 "$PROFILE_JSON" | sed 's/^/    /' >&2
  exit 13
fi
ok "profile 断言通过"

# 断言 2：composed profile 里有插件条目
run_step 14 "生成 composed profile（--dump-config）" "dump-config" \
  dsh --profile web --dump-config

DUMP_LOG="$LOG_DIR/dump-config.log"
if ! grep -Fxq -- "- id: $PKG_NAME" "$DUMP_LOG"; then
  err "失败：composed profile 中没有 '- id: ${PKG_NAME}'"
  err "命令：dsh --profile web --dump-config"
  err "检索到的近似行："
  grep -n -- "$PKG_NAME" "$DUMP_LOG" | head -5 | sed 's/^/    /' >&2 || true
  err "输出尾部："
  print_tail "$DUMP_LOG" 30
  exit 14
fi
ok "composed profile 含插件条目"

INSTALLED_VERSION="$(node -e 'try{console.log(require(process.argv[1]).version)}catch(e){console.log("unknown")}' "$PROFILE_DIR/node_modules/$PKG_NAME/package.json" 2>/dev/null || echo "unknown")"
DSH_VERSION="$(dsh --version 2>&1 | head -1)"

log ""
ok "通过：${PKG_NAME}@${INSTALLED_VERSION} 在 ${DSH_VERSION} 上完成 安装 + composed 断言"
log "  （仅安装层；声音/通知等交互行为需按 docs/COMPATIBILITY.md 手动验证）"
log "  可把这条记录补进 docs/COMPATIBILITY.md："
log "    插件版本 $INSTALLED_VERSION ｜ DSH $DSH_VERSION ｜ 安装+composed 断言 ｜ 安装层通过 ｜ $(date -u +%Y-%m-%dT%H:%MZ)"
exit 0
