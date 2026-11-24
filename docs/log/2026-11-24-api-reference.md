# 2026-11-24 · 介绍站「接口」页改成完整接口参考

- **作者**：Claude
- **范围**：`site/src/pages/api.astro`、`site/src/components/ApiToc.astro`、`ApiTool.astro`、`ApiGroup.astro`、`ApiFields.astro`、`site/src/lib/api-mcp.ts`、`api-http.ts`、`api-app.ts`、`site/src/scripts/api-toc.ts`、`site/src/components/Header.astro`；删除 `ApiFlow.astro`、`lib/api-flows.ts`；同步说明 `site/README.md`、`docs/HTTP接口一览.md`、`docs/MCP接入.md`、`docs/接口场景指南.md`、`server/mcp_prompts.py` 注释

## 改了什么
- 「接口」页从三个场景的流程轴改成完整参考，分成两大部分（唱片的 A 面 / B 面）：
  - A 面 Agent · MCP：签发令牌与四种权限、Claude Code / Codex / Cursor·VS Code / mcp-remote 的连接写法、8 个工具（按采购评估、买前查重复、闲鱼上架到入账分组，列出权限、读写、参数、返回与对应 HTTP 接口）、3 个场景模板、协议细节。
  - B 面 HTTP：令牌与会话两种鉴权的 curl 示例、通用约定与状态码；12 条对外接口，以及按用途分组的应用接口（收藏、发行资料、封面、艺人、购入、交易、周转、展示、照片、系统），共 75 条路由。
- 左侧汇总栏按两面分开、按功能分组，点击跳到对应条目，滚动时高亮当前分组。宽屏（≥64rem）吸顶常开；手机收成页眉下一条「目录 · 当前分组」，点开下拉、选中即收回。
- 页眉「接口」在本页标记为当前页。

## 出现的问题
- 字段说明按「 · 」拆分时会拆坏括号里的枚举。
- 路由总数按条目数算出 78（`/api/bulk` 等在两组都出现）。
- `astro dev` 的样式是内联注入，被 CSP 挡住，预览全无样式。
- 手机 375px 下 MCP 客户端配置片段把页面撑出横向滚动（grid 子项默认最小宽度是内容宽）。
- 宽屏侧栏比视口高时，当前分组滚出侧栏可见范围。

## 怎么解决的
- 字段拆分改成识别括号层级。
- 总数按「方法 + 去掉查询串的路径」去重，脚本核对与 `server/routes.py` 五张表一一对应（75 条，无遗漏、无多余）；MCP 工具对照 `server/mcp_tools.py`、模板对照 `mcp_prompts.py`。
- 预览改为构建后直接伺服 `site/dist`。
- `.steps > li` 与 `.clients` 设 `grid-template-columns:minmax(0,1fr)`，长片段只在 `pre` 内横向滚动。
- 当前分组变化时只滚动侧栏本身，不动页面。
- 验证：构建、CSP 检查、`tools/check_docs.py` 通过；1280px 下目录跳转落在页眉下方、高亮跟随、无横向滚动；375px 下目录条吸顶、下拉开合、跳转落点在目录条下方、`scrollWidth` 等于视口宽。

## 可能带来的新问题
- 页面数据是手写的，`server/routes.py`、`mcp_tools.py` 增减路由或参数后要同步 `site/src/lib/api-*.ts`；已在 `site/README.md`、`docs/HTTP接口一览.md`、`docs/MCP接入.md` 注明。
- 原页面的场景流程轴不再出现在站点上，按场景串调用请看 `docs/接口场景指南.md`。

## 关联
D-051 · 2026-11-24-api-scenario-guide.md
