# MCP 接入：让 Agent 直接调用 Obi

> 状态：生效中（2026-11-24 实现）。决策见 D-051。实现：`server/mcp_server.py`（协议入口）、`server/mcp_tools.py`（工具表）、`server/mcp_prompts.py`（场景模板）、`server/mcp_files.py`（限时下载链接）。测试：`tests/test_mcp.py`。

服务器版在 `POST /mcp` 提供 [MCP](https://modelcontextprotocol.io)（Model Context Protocol）入口。Claude Code、Claude Desktop、Cursor 等支持 MCP 的客户端填上地址和令牌，就能看到 Obi 的工具和场景模板，不用给 Agent 贴接口文档。HTTP 接口照旧保留，给脚本和 n8n 一类自动化用；两边是同一套处理逻辑。

## 连接

先按[对外令牌](对外令牌.md)签发一枚令牌，挂上这个 Agent 要用的权限：

```sh
docker compose exec obi python3 -m server.client_admin add 采购Agent --scope insight:read
docker compose exec obi python3 -m server.client_admin add 上架Agent --scope listing:read --scope trading:write
```

**Claude Code**

```sh
claude mcp add --transport http obi https://your.domain/mcp --header "Authorization: Bearer obi_client_…"
```

**能填请求头的客户端**（Cursor、VS Code 等）：传输方式选 HTTP（Streamable HTTP），地址 `https://your.domain/mcp`，请求头 `Authorization: Bearer obi_client_…`。

```json
{"mcpServers": {"obi": {"type": "http", "url": "https://your.domain/mcp",
                        "headers": {"Authorization": "Bearer obi_client_…"}}}}
```

**只支持本机命令的客户端**（如 Claude Desktop 的配置文件）：用 `mcp-remote` 中转。

```json
{"mcpServers": {"obi": {"command": "npx", "args": ["-y", "mcp-remote", "https://your.domain/mcp",
                        "--header", "Authorization:Bearer obi_client_…"]}}}
```

claude.ai 网页版的自定义连接器要求 OAuth 登录，当前不支持（见 D-051「何时重新评估」）。

## 工具

工具按令牌的权限列出：只有 `insight:read` 的令牌只看得到采购评估的两个工具。每个工具对应一个 HTTP 接口，参数、校验、返回内容与该接口一致。

| 工具 | 权限 | 对应接口 | 读写 |
| --- | --- | --- | --- |
| `get_purchase_profile` | `insight:read` | `GET /api/insight/profile` | 只读 |
| `evaluate_candidates` | `insight:read` | `POST /api/insight/evaluate`（单条查询也用它） | 只读 |
| `find_purchases` | `collection:read` | `GET /api/collection/purchases` | 只读 |
| `find_listing_copies` | `listing:read` | `GET /api/listing/agent/package?q=…` | 只读 |
| `get_listing_package` | `listing:read` | `GET /api/listing/agent/package?id=…`（见下） | 只读 |
| `record_listing_receipt` | `trading:write` | `POST /api/listing/agent/receipts` | 写，可重试 |
| `record_paid_order` | `trading:write` | `POST /api/trading/agent/orders` | 写，可重试 |
| `record_settlement` | `trading:write` | `POST /api/trading/agent/settlements` | 写，可重试 |

- 每个工具带 JSON Schema 参数说明和 `readOnlyHint` / `idempotentHint` 标记，客户端可据此决定哪些调用先问你。
- 成功时结果同时放在 `structuredContent`（JSON 对象）和文本里。参数无效、模块关闭、权限不足或冲突时返回 `isError: true` 和中文原因；冲突以「冲突：」开头，Agent 应停下交给你核对，不要改数据重试。
- **`get_listing_package` 不直接返回原图**：十几张原图会占满 Agent 的上下文。它返回资料包清单（发行与实物资料、照片顺序、`revision`）和 `download.url`。链接 10 分钟内有效，不需令牌，下载得到与 HTTP 资料包相同的 ZIP；过期或服务器重启后重新调用即可。副本或照片在此期间变了，下载返回 409，不会给出旧图。

## 场景模板（prompts）

[接口场景指南](接口场景指南.md)的三个场景做成了 MCP 提示模板。客户端里选一个模板、填参数，Agent 就拿到完整步骤：先调哪个工具、怎么判断、哪一步必须你确认。模板也按权限列出。

| 模板 | 需要的权限 | 参数 |
| --- | --- | --- |
| `xianyu_listing` 闲鱼上架到入账 | `listing:read` + `trading:write` | `record`：要卖的唱片 |
| `check_before_buying` 买前查重复 | `collection:read` | `record`：一张或多张唱片 |
| `purchase_scouting` 采购时挑出值得买的 | `insight:read` | `source`：网站或页面；`budget`（可选） |

模板要求 Agent 发布前给你确认文案和价格、只登记核实过的事实、不替你下单。

## 协议细节

- 传输：Streamable HTTP，无状态、只回 `application/json`，不开 SSE 流（`GET /mcp` 返回 405），不发会话 id。支持协议版本 `2025-11-25`、`2025-06-18`、`2025-03-26`；客户端请求其他版本时回 `2025-06-18`。请求头 `MCP-Protocol-Version` 不受支持时返回 400。
- 方法：initialize、ping、tools/list、tools/call、prompts/list、prompts/get；通知返回 202。其他方法返回 JSON-RPC `-32601`，未知工具或模板、缺参数返回 `-32602`。
- 鉴权在 HTTP 层：没有任何调用方令牌时 404，令牌缺失或无效 401（带 `WWW-Authenticate: Bearer`）。Host 与 Origin 校验同其他接口，浏览器跨站请求返回 403。旧的单文件令牌也能连，只看到它对应的那一组工具。

## 验证

`python3 -m unittest tests.test_mcp` 用固定样本覆盖握手、按权限过滤、工具结果与 HTTP 接口一致、下载链接（不带令牌可下、篡改与过期拒绝）和写入重试与冲突。另用官方 MCP TypeScript SDK 客户端连接本机实例，完成握手、列工具与模板、调用和取模板。
