#!/bin/bash
# Obi 发布入口（兼容层）。实际由 ai-kit 的 ship 执行（.ai-kit/ship/ship.py，配置见根目录 deploy.toml）。
# 保留原来的用法、环境变量与补丁更新器的调用方式：
#   tools/deploy.sh [--init | --rollback | --unlock] [--skip-tests] [--allow-dirty]
#   环境变量：DEPLOY_HOST DEPLOY_DIR SERVICE APP_PORT KEEP_RELEASES KEEP_SNAPSHOTS PUBLIC_URL LOCK_TTL
#             PACKAGE_PATH EXPECTED_VERSION EXPECTED_SHA256 EXPECTED_PREVIOUS_VERSION（后四项供补丁更新器）
# 个人默认值（主机 / 域名）写在 data/deploy.local.toml。DEPLOY_HOST=local 供服务器补丁更新器调用。
# 注意：$VAR 后紧跟全角字符会被 macOS bash/zsh 并入变量名，一律写成 ${VAR} 形式；shebang 必须在首行。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHIP="$ROOT/.ai-kit/ship/ship.py"
[ -f "$SHIP" ] || { echo "找不到 ${SHIP}（ai-kit 的 ship 未安装：bash .ai-kit/update.sh）" >&2; exit 1; }

# 旧环境变量 → SHIP_*（已设置 SHIP_* 的不覆盖）
carry() { local old="$1" new="$2"; if [ -n "${!old:-}" ] && [ -z "${!new:-}" ]; then export "$new=${!old}"; fi; }
carry DEPLOY_HOST SHIP_HOST
carry DEPLOY_DIR SHIP_DIR
carry SERVICE SHIP_SERVICE
carry KEEP_RELEASES SHIP_KEEP_RELEASES
carry KEEP_SNAPSHOTS SHIP_KEEP_SNAPSHOTS
carry PUBLIC_URL SHIP_PUBLIC_URL
carry LOCK_TTL SHIP_LOCK_TTL
if [ -n "${APP_PORT:-}" ] && [ -z "${SHIP_HEALTH_URL:-}" ]; then export SHIP_HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"; fi

command="deploy"
flags=()
for arg in "$@"; do
  case "$arg" in
    --rollback) command="rollback" ;;
    --unlock) command="unlock" ;;
    --init|--skip-tests|--allow-dirty) flags+=("$arg") ;;
    *) echo "未知参数：${arg}（用法见脚本头部）" >&2; exit 1 ;;
  esac
done
# 从本机工作树发布时的两道闸（服务器上的补丁更新器不经过这里）：
# 1. 远程有本地没有的提交 → 拒绝：否则会把别处已上线的改动悄悄回退。
# 2. 把这次实际发布的整棵树（含未提交、未跟踪但未被忽略的文件）存成 refs/deploys/<时间>，
#    --allow-dirty 发出去的版本也能 git checkout 原样重建；只存本地，不推送。
if [ "$command" = deploy ] && [ -z "${PACKAGE_PATH:-}" ] && [ "${DEPLOY_HOST:-}" != local ]; then
  if git -C "$ROOT" rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    git -C "$ROOT" fetch --quiet || echo "⚠ 拉取远程失败，按上次已知的远程状态检查" >&2
    behind=$(git -C "$ROOT" rev-list --count 'HEAD..@{u}')
    if [ "$behind" != 0 ]; then
      echo "✗ 远程有 ${behind} 个提交本地没有：先 git pull --rebase，否则发布会回退它们" >&2
      exit 1
    fi
  fi
  index="$(mktemp)"   # 临时索引：不碰真正的暂存区
  GIT_INDEX_FILE="$index" git -C "$ROOT" read-tree HEAD
  GIT_INDEX_FILE="$index" git -C "$ROOT" add -A
  tree=$(GIT_INDEX_FILE="$index" git -C "$ROOT" write-tree)
  rm -f "$index"
  if [ "$tree" = "$(git -C "$ROOT" rev-parse 'HEAD^{tree}')" ]; then snap=$(git -C "$ROOT" rev-parse HEAD)
  else snap=$(git -C "$ROOT" commit-tree "$tree" -p HEAD -m "deploy snapshot (uncommitted changes)"); fi
  stamp=$(date +%Y%m%d-%H%M%S)
  git -C "$ROOT" update-ref "refs/deploys/${stamp}" "$snap"
  echo "发布快照：refs/deploys/${stamp} → ${snap:0:12}（git checkout ${snap:0:12} 可重建这次发布的源码）"
fi

if [ "$command" = deploy ]; then
  [ -z "${PACKAGE_PATH:-}" ] || flags+=(--package "$PACKAGE_PATH")
  [ -z "${EXPECTED_VERSION:-}" ] || flags+=(--expect-version "$EXPECTED_VERSION")
  [ -z "${EXPECTED_SHA256:-}" ] || flags+=(--expect-sha256 "$EXPECTED_SHA256")
  [ -z "${EXPECTED_PREVIOUS_VERSION:-}" ] || flags+=(--expect-previous "$EXPECTED_PREVIOUS_VERSION")
fi

exec python3 "$SHIP" --root "$ROOT" "$command" ${flags[@]+"${flags[@]}"}
