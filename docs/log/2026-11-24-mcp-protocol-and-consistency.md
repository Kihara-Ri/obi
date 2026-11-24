# 2026-11-24 · MCP 协议与资料一致性

- **作者**　Codex
- **范围**　MCP 协议、限时资料包、调用方令牌管理与接入文档（D-050 至 D-052）。

## 改了什么

- 同一个 `/mcp` 支持 `2026-07-28` 和旧版握手。新版校验请求头与请求元数据，提供服务发现、版本错误和带 `resultType` 的结果。
- 上架链接绑定副本版本、照片版本和顺序，在同一写锁内校验并打包。编辑副本资料后，旧链接返回 409。
- 网页和命令行以同一把文件锁串行更新调用方清单，迁移旧令牌也走同一锁。锁文件与原子替换的清单分离。
- 接入说明补上设置页、Codex CLI 与 Claude 的请求头认证，Docker 示例使用 Compose 服务名 `app`。

## 出现的问题

- Claude Code 的新版发现请求返回 400，随后回退到旧协议。实现以 [新版 Streamable HTTP 规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) 和 [发现响应规范](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) 为准。
- 旧签名只绑定照片版本，编辑标题后旧链接仍打包新版副本。进程内锁也无法阻止网页和命令行交叉覆盖令牌清单。
- 首轮全量测试与前端重建并行时，静态资源检查遇到构建前清理。后端套件改在构建完成后执行。

## 证据

- 后端 605 项与前端 202 项测试通过。包含纯资料编辑使旧链接失效、新链接可下载，以及网页签发与命令行撤销交错执行的回归。
- Claude Code 使用 `2026-07-28` 完成发现和列工具。官方 TypeScript SDK 1.32.2 用 `2025-11-25` 访问 8 个工具和 3 个模板，并成功查询已购、获取模板。
- 375px Chromium 上验证令牌签发、轮换、撤销和新版工具列表，控制台无错误。既有上架和照片下载浏览器验收、Docker 构建、介绍站 CSP 及 375px 与 1280px 页面检查通过。

## 影响范围

- 重启实例后需重新取限时下载链接。网页和命令行应使用同一数据目录与更新后的代码。
- Claude 网页版的接入步骤依据 [官方文档](https://claude.com/docs/connectors/custom/add-unlisted#authenticate-with-request-headers)，实际账户的功能开放及连接仍待验证。
