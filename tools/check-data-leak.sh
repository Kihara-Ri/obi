#!/bin/sh
# 数据泄漏扫描：本地钩子（--cached 扫暂存区）与 CI（tree 扫 tracked 全量）共用。
# 拦截两类内容：①数据文件（数据库/备份/凭证/环境密钥/个人文档）②个人身份串与私钥。
set -eu
cd "$(git rev-parse --show-toplevel)"

# 个人身份串（域名 / 主机别名 / 账号等）不写进仓库：每行一个 ERE，放 data/leak-patterns.txt（未跟踪），
# CI 可用仓库 secret LEAK_PATTERNS 提供同样内容（换行分隔）。两者都没有时只做通用扫描。
FILE_RE='((^|/)listing-(chatgpt|providers)[.](json|tmp|lock)$|(^|/)listing-anthropic/|^data/|\.sqlite3$|\.sqlite3-|\.env$|(^|/)update\.env$|(^|/)vision-config\.json$|/albums\.json$|^albums\.json$|部署登录信息|出售记录|封面核对报告|管理系统方案|运营记录)'
CONTENT_RE='BEGIN [A-Z ]*PRIVATE KEY|sk-(proj-)?[A-Za-z0-9_-]{40,}|eyJ[A-Za-z0-9_-]{10,}[.]eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{20,}'
personal=$( { [ -f data/leak-patterns.txt ] && cat data/leak-patterns.txt; printf '%s\n' "${LEAK_PATTERNS:-}"; } \
    | grep -vE '^[[:space:]]*(#|$)' | paste -sd '|' - || true)
[ -z "$personal" ] || CONTENT_RE="$CONTENT_RE|$personal"

fail=0
if [ "${1:-tree}" = "--cached" ]; then
    names=$(git diff --cached --name-only || true)
    bad_content=$(git grep --cached -lIE "$CONTENT_RE" -- . 2>/dev/null || true)
else
    names=$(git ls-files)
    bad_content=$(git grep -lIE "$CONTENT_RE" -- . 2>/dev/null || true)
fi

bad_files=$(printf '%s\n' "$names" | grep -E "$FILE_RE" || true)
if [ -n "$bad_files" ]; then
    echo "✗ 以下文件属于个人数据 / 密钥，不得入库（移到 data/ 或加入 .gitignore）："
    echo "$bad_files"
    fail=1
fi
if [ -n "$bad_content" ]; then
    echo "✗ 以下文件包含个人身份串或私钥，请用占位符替换："
    echo "$bad_content"
    fail=1
fi

if [ "$fail" -eq 0 ]; then
    echo "✓ 数据泄漏扫描通过"
fi
exit $fail
