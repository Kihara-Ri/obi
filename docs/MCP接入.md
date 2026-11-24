# MCP 接入：让 Agent 直接调用 Obi

> 状态：生效中（2026-11-24 实现）。决策见 D-051。实现：`server/mcp_server.py`（协议入口）、`server/mcp_protocol.py`（版本与请求校验）、`server/mcp_tools.py`（工具表）、`server/mcp_prompts.py`（场景模板）、`server/mcp_files.py`（限时下载链接）。测试：`tests/test_mcp.py`。

服务器版在 `POST /mcp` 提供 [MCP](https://modelcontextprotocol.io)（Model Context Protocol）入口。Claude Code、Claude Desktop、Cursor 等支持 MCP 的客户端填上地址和令牌，就能看到 Obi 的工具和场景模板，不用给 Agent 贴接口文档。HTTP 接口照旧保留，给脚本和 n8n 一类自动化用；两边是同一套处理逻辑。

## 连接

在 Obi 服务器版登录后，打开「设置 → 高级 → MCP 服务」，复制地址并为调用方选择权限。签发或轮换时保存令牌，页面只展示一次。也可用[服务器命令行](对外令牌.md)签发。

```sh
docker compose exec app python3 -m server.client_admin add 采购Agent --scope insight:read
docker compose exec app python3 -m server.client_admin add 上架Agent --scope listing:read --scope trading:write
```

**Claude Code**

```sh
claude mcp add --transport http obi https://your.domain/mcp --header "Authorization: Bearer obi_client_…"
```

**Codex CLI**

从客户端的密钥配置提供 `OBI_MCP_TOKEN` 环境变量，再登记 MCP 地址。

```sh
codex mcp add obi --url https://your.domain/mcp --bearer-token-env-var OBI_MCP_TOKEN
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

**Claude 网页版和桌面版的远程连接器**。如果添加自定义连接器时显示「Request headers」，填入 Obi 的 HTTPS MCP 地址，选择「No sign-in」，将 `Authorization` 的值设为 `Bearer <Obi 令牌>`。请求头认证是逐步开放的测试功能。没有此入口的账户可使用 Claude Code，桌面版也可按上面的本机命令方式中转。[Claude 请求头认证说明](https://claude.com/docs/connectors/custom/add-unlisted#authenticate-with-request-headers)

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
- **`get_listing_package`** 返回资料包清单（发行与实物资料、照片顺序、`revision`）和 `download.url`。签名链接 10 分钟内可直接下载 ZIP。链接绑定清单的副本版本、照片版本和顺序。链接返回 409 时重新获取资料包并核对新版清单。链接过期或服务器重启后也需重新获取。

## 场景模板（prompts）

[接口场景指南](接口场景指南.md)的三个场景做成了 MCP 提示模板。客户端里选一个模板、填参数，Agent 就拿到完整步骤：先调哪个工具、怎么判断、哪一步必须你确认。模板也按权限列出。

| 模板 | 需要的权限 | 参数 |
| --- | --- | --- |
| `xianyu_listing` 闲鱼上架到入账 | `listing:read` + `trading:write` | `record`：要卖的唱片 |
| `check_before_buying` 买前查重复 | `collection:read` | `record`：一张或多张唱片 |
| `purchase_scouting` 采购时挑出值得买的 | `insight:read` | `source`：网站或页面；`budget`（可选） |

模板要求 Agent 发布前给你确认文案和价格、只登记核实过的事实、不替你下单。

## 协议细节

- 传输采用无状态 Streamable HTTP，响应为 `application/json`，`GET /mcp` 返回 405。`2026-07-28` 客户端可调用 server/discover，也可直接调用工具和模板。请求带协议版本、方法和适用的名称请求头以及匹配的请求元数据，成功结果带 `resultType: complete`。见 [现代 Streamable HTTP 规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)。
- 旧版客户端继续通过 initialize 协商 `2025-11-25`、`2025-06-18` 或 `2025-03-26`。旧版握手提出其他版本时回 `2025-06-18`。请求头指定不支持的版本时返回 HTTP 400 与 `-32022`，附支持版本列表。
- 两种协议均提供 ping、tools/list、tools/call、prompts/list、prompts/get。未知方法返回 JSON-RPC `-32601`，新版同时返回 HTTP 404。通知返回 202，未知工具或模板及结构无效的参数返回 `-32602`。
- 鉴权在 HTTP 层：没有任何调用方令牌时 404，令牌缺失或无效 401（带 `WWW-Authenticate: Bearer`）。Host 与 Origin 校验同其他接口，浏览器跨站请求返回 403。旧的单文件令牌也能连，只看到它对应的那一组工具。

## 验证

`python3 -m unittest tests.test_mcp tests.test_client_api` 用固定样本验证新旧协议、权限、工具结果与 HTTP 接口一致性、资料包版本、交易写入重试和令牌管理。测试通过真实 HTTP 请求连接隔离实例。
