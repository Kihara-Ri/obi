# 2026-11-24 · 设置里的 MCP 服务卡片

- **作者**：Claude
- **范围**：server/client_api.py（新增）、agent_clients.py（issue / rotate / set_scopes / revoke）、client_admin.py、routes.py；web/src/components/McpSettings/（新增）、SettingsPage、REGISTRY.md；tests/test_client_api.py

## 改了什么
设置 · 高级加「MCP 服务」：MCP 地址可复制，调用方列表可换令牌、两步撤销，新增调用方用名称加四项权限开关；签发后令牌和 Claude Code 连接命令只显示一次。见 D-052。

## 出现的问题
- 命令行的签发逻辑写在 `client_admin` 里，靠 SystemExit 报错，网页无法复用。
- 原以为没设密码时接口不需登录；实际服务器这时拒绝所有接口（401）。

## 怎么解决的
- 把签发、轮换、改权限、撤销移进 `agent_clients`，加进程内锁，命令行和网页共用。
- 测试按实际行为写；`client_api` 仍检查已设密码，多挡一次。

## 可能带来的新问题
- 会话被盗可签发长期令牌（见 D-052 代价）。
- 网页不提供改权限的入口（接口已有），要改权限可撤销后重签，或用命令行。

## 证据
- `tests/test_client_api.py` 3 项；浏览器 375px 宽：签发令牌后用它调用 tools/list 返回 5 个上架与交易工具，两步撤销后列表剩 1 个，无横向溢出。
