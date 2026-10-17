# 2026-10-17 · 接入 ai-kit

- **作者**：Claude
- **范围**：`.ai-kit/` `.githooks/` `.claude/` `tools/hooks/pre-commit` `AGENTS.md` `docs/DECISIONS.md` `docs/KNOWN-ISSUES.md`

## 改了什么
接入 ai-kit v0.2.0：12 条铁律、SessionStart/PostToolUse/Stop 钩子、git pre-commit 门禁；`tools/hooks/pre-commit` 在数据泄漏扫描通过后继续执行 ai-kit 检查（只检查暂存文件）；存量文件列入 `.ai-kit/legacy.txt`；`AGENTS.md` 补充 ai-kit 纪律与「新单元组件样式同目录」的例外；决策 D-001～D-003。

## 出现的问题
安装脚本默认把 `core.hooksPath` 改为 `.githooks`，会绕开项目自己的 `tools/hooks`（数据泄漏扫描）。

## 怎么解决的
安装后手动把 hooksPath 还原为 `tools/hooks`，由其链式调用 `.githooks/pre-commit`；不合并 `.gitignore`、不引入灰度 token。

## 可能带来的新问题
白名单内的文件被改动时不会被 ai-kit 拦住；需要靠评审与逐步拆分移出白名单。

## 关联
D-001 D-002 D-003
