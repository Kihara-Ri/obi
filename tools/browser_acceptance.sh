#!/bin/bash
# 上架记录与照片下载的本地一键验收。构建前端后在固定样本副本上运行主验收与长文验收。
# CI 的同名任务也直接调用本脚本（OBI_ACCEPTANCE_HOME 指向已准备的样本目录，OBI_SKIP_BUILD=1 用已构建的 static/），
# 本地与 CI 只有这一份步骤。
# 固定样本目录 OBI_ACCEPTANCE_HOME（默认 ~/.cache/obi-acceptance，仓库外）；首次约 75 秒下载素材，
# 缓存坏了或样本版本变了会自动重建。长文写入隔离副本，截图与失败现场在 OBI_PREVIEW_SCREENSHOTS。
# 注意：$VAR 后紧跟全角字符会被 macOS bash 并入变量名，一律写成 ${VAR}。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
HOME_DIR="${OBI_ACCEPTANCE_HOME:-$HOME/.cache/obi-acceptance}"
RUN="$(mktemp -d "${TMPDIR:-/tmp}/obi-listing-run.XXXXXX")"
export OBI_PREVIEW_SCREENSHOTS="${OBI_PREVIEW_SCREENSHOTS:-${RUN}/shots}"
step() { printf '\n== %s\n' "$1"; }

if [ ! -d web/node_modules/playwright ]; then
  echo "缺少前端依赖：先运行 npm --prefix web ci && npx --prefix web playwright install chromium" >&2; exit 1
fi

if [ "${OBI_SKIP_BUILD:-}" != 1 ]; then
  step "构建前端（服务读取 static/）"
  npm --prefix web run build > "${RUN}/build.log" 2>&1 || { cat "${RUN}/build.log"; exit 1; }
fi

step "准备固定样本缓存 ${HOME_DIR}"
prepare() { OBI_DEV_HOME="$HOME_DIR" python3 tools/preview_samples.py prepare --download > "${RUN}/prepare.log" 2>&1; }
# 自愈：先只丢掉实例重建（已下载的素材按哈希复用），还不行再整个目录重来。
if ! prepare; then
  echo "样本实例不可用（$(tail -1 "${RUN}/prepare.log")），重建实例…"
  rm -rf "${HOME_DIR}/instance"
  if ! prepare; then
    echo "仍不可用，整个样本目录重新下载…"
    rm -rf "$HOME_DIR"
    prepare || { cat "${RUN}/prepare.log"; exit 1; }
  fi
fi

step "复制一份干净实例到 ${RUN}/instance"
if [ "$(uname)" = Darwin ]; then cp -Rc "${HOME_DIR}/instance" "${RUN}/instance"; else cp -R "${HOME_DIR}/instance" "${RUN}/instance"; fi
seed() { python3 -c "import sys; from pathlib import Path; import tools.seed_samples as s; getattr(s, sys.argv[1])(Path(sys.argv[2]))" "$1" "${RUN}/instance"; }
seed seed_listing_reference_photos

step "启动固定样本验收服务"
python3 tests/serve_listing_acceptance.py --data-dir "${RUN}/instance" > "${RUN}/server.log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT
url=""
for _ in $(seq 1 60); do
  url=$(sed -n 's/^ACCEPTANCE_URL=//p' "${RUN}/server.log" | head -1)
  [ -n "$url" ] && break
  kill -0 "$server_pid" 2>/dev/null || { cat "${RUN}/server.log"; exit 1; }
  sleep 1
done
[ -n "$url" ] || { echo "验收服务 60 秒内没有就绪" >&2; cat "${RUN}/server.log"; exit 1; }

fail() {
  echo "" >&2
  echo "✗ $1 未通过。截图与失败现场：${OBI_PREVIEW_SCREENSHOTS}" >&2
  echo "  服务日志：${RUN}/server.log    单独重跑：tools/browser_acceptance.sh" >&2
  exit 1
}
step "上架记录与照片下载验收"
LISTING_ACCEPTANCE_URL="$url" node web/tests/browser/listing-acceptance.mjs || fail "上架记录与照片下载验收"
# 经 storage 写入固定长文，验证历史资料能完整阅读、复制。
seed seed_listing_long_copy
step "文案阅读验收"
LISTING_ACCEPTANCE_URL="$url" node web/tests/browser/listing-reader-acceptance.mjs || fail "文案阅读验收"
printf '\n✓ 上架记录与照片下载验收通过（截图：%s）\n' "$OBI_PREVIEW_SCREENSHOTS"
rm -rf "${RUN}/instance"  # 通过后清掉复制的实例，失败时保留现场
