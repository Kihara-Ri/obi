# 2026-11-24 · MCP 入口

- **作者**：Claude
- **范围**：server/mcp_server.py、mcp_tools.py、mcp_prompts.py、mcp_files.py（新增）；server/agent_auth.py（caller、any_enabled）、listing_agent.py（拆出资料包清单）、routes.py、http.py；tests/test_mcp.py；docs/MCP接入.md、DECISIONS、HTTP接口一览、对外令牌、接口场景指南、部署说明、CHANGELOG、README；site 接口页

## 改了什么
服务器版新增 `POST /mcp`，按 MCP 的 Streamable HTTP 传输（无状态、纯 JSON）提供 8 个工具和 3 个场景模板，鉴权沿用调用方令牌，按权限列出。每个工具直接调用对应 HTTP 接口的处理函数。上架资料给 10 分钟有效的签名下载链接 `GET /api/mcp/package`。

## 出现的问题
- 原资料包接口一次读出全部原图打成 ZIP，放进工具结果会占满 Agent 上下文。
- `tools/check_docs.py` 把文档里写成代码的 `tools/list` 当成仓库路径检查。

## 怎么解决的
- 从 `_package` 拆出 `_prepare` / `_manifest`，新增不读原图的 `package_preview`；工具返回清单和签名链接，下载时仍走 `_package`，副本或照片变了返回 409。签名密钥只在进程内存，重启即失效。
- 协议方法名在文档里不用代码格式。
- 没引入 MCP SDK：后端只用标准库，需要的方法只有 6 个。放弃本机 stdio 中转方案：数据和令牌都在服务器上，远程入口任何设备都能连。

## 可能带来的新问题
- 下载链接在 10 分钟内不需令牌；令牌撤销后已发出的链接仍可用到过期。
- 不支持 OAuth，claude.ai 网页版自定义连接器接不上。
- 工具说明与 HTTP 接口契约是两份文字，接口变化时需同步。

## 证据
- `tests/test_mcp.py` 4 项：握手与版本协商、404/401/405/跨站 403、按权限列工具和模板、工具结果与 HTTP 接口一致、下载链接（免令牌、篡改与过期拒绝）、回执重试一致与冲突、订单与到账入账。
- 官方 MCP TypeScript SDK 1.32.2 客户端连接本机实例：协商 2025-11-25，列出 8 个工具、3 个模板，调用评估成功，错误路径返回 isError，取模板成功。
- 站点 check 与 build 通过；浏览器桌面与 375px 宽检查接口页，8 个 MCP 标记、3 个模板名，无横向溢出。

## 关联
D-051 · D-050 · D-049 · 2026-11-24-client-tokens-and-purchase-insight.md
