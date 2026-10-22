# 2026-10-21 · /api/state：设置白名单、ETag 304、只发变化的行

- **作者**：Claude
- **范围**：storage.py（`state`、`backup`、`STATE_SETTINGS`）、server/state_sync.py（新）、server/routes.py、web/src/core/state-sync.ts（新）、web/src/App.tsx、web/src/types.ts、tests/test_state_sync.py（新）、web/tests/state-sync.test.mjs（新）、docs/模块扩展指南.md、docs/DECISIONS.md

## 改了什么
- **设置白名单**：`state()` 不再整份读取 `meta` 表、也不再复用 `backup()`。现在只取三张表、最近 100 条 audit，以及 `STATE_SETTINGS` 里登记的设置（目前只有 `showcase-groups-v1`）。`modules-v1` 和 `start-page-v1` 照旧用来计算 `modules`。
- **去掉 `createdAt`**：每次都会变，会让 ETag 永远对不上；前端从没读过它。
- **ETag 与增量（D-018）**：
  - 响应带内容哈希 ETag，前端 `refresh()` 带上 `If-None-Match`，没变回 304，前端不重渲染。
  - 有变化且服务器还记得前端那份时，只回变化的行（put）和消失的行（drop），前端拼回完整状态，没变的行保持原对象。
- `backup()` 去掉只给 state 用的 `audit_limit` 参数。

## 出现的问题
- 原计划是「写接口返回改动记录，前端就地更新」。看过调用点后改为在 `/api/state` 上做增量，原因：
  - 约 20 个写入后的 `refresh()` 分散在表单、批量操作、流转、展示分组、模块设置、导入等处；
  - 成本、净额、利润和汇率由服务端在 `state()` 里派生，逐个接口返回「装饰后」的记录，等于把 `state()` 的派生逻辑拆到每个接口。
  - 增量方案只改 `refresh()` 一处，所有路径都受益，正确性可以用「拼出的结果等于整份」一条性质来测。
- 增量和整份共用一个 ETag，而 `send()` 按 ETag 缓存 gzip 结果：增量如果也走 `etag=` 参数，会被当作整份的压缩结果发出。增量的 ETag 因此改走普通响应头，并加了一条走真实请求管线的测试。
- `INSERT OR REPLACE` 会给改过的行换 rowid，行序随之变化。拼法规定为「没变的行保持原顺序，put 接在后面」，拼出来与服务器顺序不同时附上完整 `order`。

## 怎么解决的
- 在 `server/state_sync.py` 和 `core/state-sync.ts` 两端各写一份对照的拼法。
- `tests/test_state_sync.py` 用真实 Store 跑这些场景，每一步都断言「拼出的状态 == `store.state()`」（含行序）：编辑、移入回收站、新增、售出、audit 窗口滑动、恢复备份、未知基线、行重排。
- 前端用 `web/tests/state-sync.test.mjs` 覆盖同一拼法，以及 304、基线对不上时整份重拉、401 错误语义。
- 响应仍是 `no-store`（D-009）。前端手动带 If-None-Match 时，浏览器不走 HTTP 缓存，304 会原样交给脚本处理。

## 可能带来的新问题
- 前端以后要读新的设置键，必须先登记到 `STATE_SETTINGS`，否则读到的是 undefined。这一点已写进 `docs/模块扩展指南.md`。
- 每次请求多算一遍行摘要：1500 张专辑时本机约 13ms，现有数据量下为几毫秒。
- 已验证：Python 全量测试、web 测试、类型检查。浏览器验证见本次总报告。

## 关联
D-009 · D-018 · 2026-10-21-bulk-feedback-first.md
