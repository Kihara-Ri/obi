# 2026-11-24 · 按调用方签发令牌与采购评估接口

- **作者**：Claude
- **范围**：server/agent_clients.py、agent_auth.py、client_admin.py、insight_stats.py、insight_data.py、insight_model.py、insight_api.py、routes.py、context.py、app.py；tests/test_agent_clients.py、test_insight_api.py；接口文档、部署说明、DECISIONS、CHANGELOG、README；site 接口页

## 改了什么
- D-050：每个调用方一枚令牌，带权限（listing:read / trading:write / collection:read / insight:read），可单独轮换、吊销；旧的单令牌文件继续生效并映射到固定权限。没有调用方具备某权限时接口返回 404，缺失或错误令牌 401，权限不足 403。管理命令 `python3 -m server.client_admin`。
- D-049：新增 `GET /api/insight/profile`、`POST /api/insight/evaluate`、`GET /api/insight/releases`，需要 insight:read。按发行（编号、条码）→ 专辑 → 艺人匹配，CD / LP / 其他分开统计，指数近期加权（半衰期默认 180 天、可调 60–720，窗口 36 个月），给出已有库存、历史成交、落地成本与预计利润。
- 接口场景指南新增「场景三：采购时挑出值得买的」；站点接口页新增权限签发区块与采购流程轴。

## 出现的问题
- 管理命令最初放在 `tools/obi_client.py`，但 Docker 镜像不包含 `tools/`，文档里的 `docker compose exec` 命令会失败。
- 单条样本给出精确金额会暴露单笔成本；两条样本的 10%/90% 分位等于两笔原值。
- 原契约写了候选过多返回 413，但请求体上限是全局 50 MB，按路由限体积不划算。

## 怎么解决的
- 命令移到 `server/client_admin.py`，镜像内可用 `python3 -m server.client_admin`。
- n=1 的金额改为约 ×1.5 一档的比例区间，比例与天数 n<2 时为 null；costRange 至少 3 条。估算遇到只有 1 条样本的成本参数取区间上限（保守）。
- 候选条数在校验层限制为 1–50，超出返回 400，契约删掉 413。
- 未登记介质的副本按 CD 计（收藏以 CD 为主，黑胶和磁带通常会登记介质）。已上架未售天数取审计里最近一次标记上架的时间。

## 可能带来的新问题
- 介质缺失按 CD 计，个别未登记的黑胶会混进 CD 统计。
- 艺人匹配只做归一化比较，别名、译名不会合并。
- 无已知其他隐患，已验证：见下方证据。

## 证据
- `python3 tools/run_tests.py`、`python3 tools/check_docs.py`、`site` 的 `npm run build` 与 `npm run check`，结果见本次汇报。
- 浏览器 375px 与桌面宽度检查接口页：4 个场景、4 个权限、403 规则渲染正常，无横向溢出。

## 关联
D-049 · D-050 · 2026-11-24-purchase-insight-proposal.md · 2026-11-24-api-scenario-guide.md
