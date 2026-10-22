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
if [ "$command" = deploy ]; then
  [ -z "${PACKAGE_PATH:-}" ] || flags+=(--package "$PACKAGE_PATH")
  [ -z "${EXPECTED_VERSION:-}" ] || flags+=(--expect-version "$EXPECTED_VERSION")
  [ -z "${EXPECTED_SHA256:-}" ] || flags+=(--expect-sha256 "$EXPECTED_SHA256")
  [ -z "${EXPECTED_PREVIOUS_VERSION:-}" ] || flags+=(--expect-previous "$EXPECTED_PREVIOUS_VERSION")
fi

exec python3 "$SHIP" --root "$ROOT" "$command" ${flags[@]+"${flags[@]}"}
