# 2026-10-17 · 治理文档工程化：统一索引、机械校验、清理过时内容

- **作者**：Claude
- **范围**：`docs/README.md`（新）、`tools/check_docs.py`（新）、`tests/test_docs_governance.py`（新）、`tools/hooks/pre-commit`、`AGENTS.md`、`README.md`、`使用说明.md`、`部署说明.md`、`docs/模块扩展指南.md`、`docs/DECISIONS.md`（D-008）；删除 `docs/CHATGPT_PROJECT_CONTEXT.md`、本地 `.zcode/plans/`

## 改了什么
- 新增 `docs/README.md` 作为唯一治理索引：规范、契约、运维说明各自的作用与维护入口。
- 新增 `tools/check_docs.py`：校验治理文档的 Markdown 链接、反引号中的仓库路径、D-/I- 编号，以及 `docs/*.md` 是否全部登记在索引中。已删除的历史路径写成 `~~…~~` 视为不存在。
- 接入 pre-commit（数据泄漏扫描之后、ai-kit 检查之前），并由 `tests/test_docs_governance.py` 纳入单元测试。
- 删除内容已过期的 `docs/CHATGPT_PROJECT_CONTEXT.md`（2026-10-13/14 的决策快照，引用已删除的 `server/recognition.py`）以及本地 `.zcode/plans/` 的旧架构重构方案（引用 `static/app.js` 等已不存在的文件）。
- 修正失效引用：闲鱼只读试验章节与段落（工具不在主线）、`data/imports`/`vision-config.json` 旧路径、模块扩展指南中的旧模型脚本路径、AGENTS 与 README 中对已删文件的引用。

## 出现的问题
检查首次运行发现 15 处失效引用，其中包括一整节指向不存在工具的说明，以及一份已删除功能的摘要仍在 README 中被推荐上传。

## 怎么解决的
逐条核对后分类：路径确实失效的修正或删除；历史决策中提到的已删路径改为删除线（决策记录只增不删）；数据目录与占位符不属于仓库文件，检查时跳过。

## 可能带来的新问题
- 若用户曾把 `CHATGPT_PROJECT_CONTEXT.md` 上传到外部 ChatGPT Project，仓库删除不会同步该外部副本，需要手动更新或移除。
- 检查器只覆盖反引号路径与 Markdown 链接，不理解语义上的过时；过时判断仍需人工复核。
- 闲鱼只读工具仅在本地对象中可找到（commit eba559d），若要恢复需从该提交取出。

## 验证
- `python3 tools/check_docs.py`：18 个文件，0 处问题。
- `sh tools/hooks/pre-commit`：数据泄漏扫描通过，治理检查通过。
- `python3 -m unittest discover -s tests`：全部通过，1 项跳过。

## 关联
D-008、D-007、AGENTS.md「治理文档」条目
