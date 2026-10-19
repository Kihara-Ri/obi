#!/usr/bin/env python3
"""治理文档检查：规定性文档不得指向已不存在的路径、链接或决策/问题编号。

检查范围见 GOVERNED；退出码非零即失败。用途：
- 文档随代码迁移时，失效引用立刻暴露，而不是靠人读出来；
- pre-commit 只在暂存了治理文档时运行（tools/hooks/pre-commit）。

规则：
1. Markdown 链接 `[..](相对路径)` 指向的文件必须存在（锚点与外部链接忽略）；
2. 反引号中形如仓库路径（以已知顶层目录开头）的文本必须存在；含通配符或占位符的跳过；
3. `D-\\d{3}` 必须在 docs/DECISIONS.md 中定义，`I-\\d{3}` 必须在 docs/KNOWN-ISSUES.md 中定义。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

GOVERNED = [
    'AGENTS.md', 'CLAUDE.md', 'README.md', '使用说明.md', '部署说明.md', 'AI开发复盘.md',
    '.impeccable.md', '.ai-kit/rules.md', 'web/src/components/REGISTRY.md',
    'web/tests/browser/README.md', 'docs/*.md',
]
TOP_DIRS = ('server/', 'web/', 'tools/', 'docs/', 'tests/', 'vendor/', 'plugins/', 'static/',
            'deploy/', '.ai-kit/', '.githooks/')
# 文档约定的构建输出目录：生成后即删除，不入库，不做存在性检查
GENERATED_OUTPUTS = ('static/model-regression/',)
# 历史记录中的已删路径写成 ~~…~~，视为不再存在的引用（决策记录只增不删）
STRUCK_RE = re.compile(r'~~.*?~~')
LINK_RE = re.compile(r'\[[^\]]*\]\(([^)\s]+)\)')
CODE_RE = re.compile(r'`([^`\n]+)`')
DECISION_RE = re.compile(r'\bD-(\d{3})\b')
ISSUE_RE = re.compile(r'\bI-(\d{3})\b')
PLACEHOLDER = ('*', '<', '>', '…', '{', '}', '$', '日期', 'slug', '草稿id', '记录id', '内容哈希')


def governed_files():
    out = []
    for pattern in GOVERNED:
        out.extend(sorted(ROOT.glob(pattern)))
    return [p for p in out if p.is_file()]


def defined_ids(path, prefix):
    if not path.exists():
        return set()
    return set(re.findall(rf'^## ({prefix}-\d{{3}})\b', path.read_text(encoding='utf-8'), re.M))


def check_file(path, decisions, issues):
    errors = []
    text = path.read_text(encoding='utf-8')
    rel = path.relative_to(ROOT)
    for target in LINK_RE.findall(text):
        if re.match(r'^(https?:|mailto:|#)', target):
            continue
        target = target.split('#', 1)[0]
        if not target:
            continue
        if not (path.parent / target).resolve().exists():
            errors.append(f'{rel}: 链接失效 → {target}')
    for code in CODE_RE.findall(STRUCK_RE.sub('', text)):
        code = code.split(':', 1)[0] if '.py:' in code or '.mjs:' in code or '.ts:' in code else code
        if not code.startswith(TOP_DIRS) or any(c in code for c in PLACEHOLDER) or ' ' in code:
            continue
        if code.startswith(GENERATED_OUTPUTS):
            continue
        if not (ROOT / code).exists():
            errors.append(f'{rel}: 路径不存在 → {code}')
    for num in set(DECISION_RE.findall(text)):
        if f'D-{num}' not in decisions:
            errors.append(f'{rel}: 决策编号未定义 → D-{num}')
    for num in set(ISSUE_RE.findall(text)):
        if f'I-{num}' not in issues:
            errors.append(f'{rel}: 已知问题编号未定义 → I-{num}')
    return errors


def check_index():
    """docs/*.md（除索引自身）必须全部登记在 docs/README.md。"""
    index = (ROOT / 'docs/README.md').read_text(encoding='utf-8')
    errors = []
    for doc in sorted((ROOT / 'docs').glob('*.md')):
        if doc.name != 'README.md' and doc.name not in index:
            errors.append(f'docs/README.md: 未登记 → docs/{doc.name}')
    return errors


def main(argv):
    decisions = defined_ids(ROOT / 'docs/DECISIONS.md', 'D')
    issues = defined_ids(ROOT / 'docs/KNOWN-ISSUES.md', 'I')
    files = [Path(a) for a in argv] if argv else governed_files()
    errors = []
    for f in files:
        path = f if f.is_absolute() else ROOT / f
        if path.is_file():
            errors.extend(check_file(path, decisions, issues))
    if not argv:
        errors.extend(check_index())
    for e in errors:
        print(e)
    print(f'治理文档检查：{len(files)} 个文件，{len(errors)} 处问题')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
