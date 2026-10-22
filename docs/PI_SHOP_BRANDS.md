# 购买渠道图标 · Pi 模型补全

购买渠道名称由用户输入并归属实物购买记录；**模型只尝试补充品牌官方域名及图标，不更名、不改金额、不写回交易资料**。

## 实现

- 新渠道仅在 `POST /api/records` 保存成功、且以前从未出现过相同规范化名称时异步调度一次。空值、只有一个字符和已存在渠道不触发。
- `server/shop_brands.py` 单工作线程调用本机 Pi CLI（无 tools / extensions / skills / 项目上下文 / session）；Pi 的 provider 和凭据由 Pi 本身管理。
- 模型只返回可信度和**可能的官方域名**；仅采纳 `confidence=high` 且符合 DNS 域名格式的结果；未知或个体店铺维持首字图标。
- 图片通过固定 Google Favicon 服务获取，重定向限制在 Google/gstatic，限 64 KiB，仅接受 PNG，保存于数据目录 `shop-icons/`；浏览器只访问本项目 `/api/shop-brand-icon/<hash>.png`。
- 识别结果存入 SQLite `meta['shop-brand-cache-v1']`，不重复调用。模型失败记 `unavailable`，提供显式“重试识别图标”；重启时未完成任务也可重试。
- `GET /api/shop-brands` 供前端展示查询状态；`POST /api/shops/retry` 只能为已保存的购买渠道重试。所有接口均沿用现有会话登录保护。
- 用户购买渠道文本始终保持原值。图标属于**候选商标推断**，不能作为经过官方认证的品牌证明。

## 使用 Pi 与 ChatGPT OAuth

项目目前通过 **Pi CLI 适配器**使用 Pi 的统一 provider / authentication 体系；不是把 `@earendil-works/pi-ai` JavaScript SDK 直接安装到 Python 服务器内。CLI 是受约束、无工具调用的单次文本生成，不会让 Agent 读取用户收藏或本地文件。

已安装 Pi 的本机执行：

```sh
# 新版本 Pi 需要 Node.js 22.19+，本机有 ~/.nvm/versions/node/v22.*。
pi --version
pi
# 在 Pi 中执行 /login，选择 OpenAI Codex（ChatGPT Plus/Pro）
```

或配置 Pi 支持的其他服务商 API Key。OAuth 保存在 Pi 的用户级权限受限 `~/.pi/agent/auth.json`，**不能上传至仓库或浏览器**。模型调用仅在服务端，凭据轮换由 Pi 自己完成。

可通过服务进程环境变量明确指定：
- `SHOP_PI_PROVIDER` 默认 `openai-codex`
- `SHOP_PI_MODEL` 默认 `gpt-5.5`（ChatGPT OAuth 通道；账户实际可用性受订阅和额度限制）

也可改为其他 Pi provider/model（如使用自己的 API Key），不会自动切换到可能产生额外费用的其他服务商。**Pi 未安装、认证失效、模型不可用、额度用尽、店铺无法可靠识别，都不会阻止专辑保存。**

2026-10-13 本机验证：Pi CLI 0.85.0、Node 22 可运行，存在 `openai-codex` OAuth 记录；`gpt-5.4-mini` 与 `gpt-5.4` 在该账号的 Codex 通道返回不支持；`gpt-5.5` 等返回 usage limit reached，因此本次**不能宣称真正推理成功**。固定 Google Favicon 的真实请求验证成功；测试使用 mock Pi，不会消耗额度。

运行于 Docker/服务器时，如没有安装 Pi CLI 并单独授权该服务进程的模型凭据，本功能只显示占位图标。不要将个人 ChatGPT OAuth 授权用作多用户公共 API 服务，生产多用户环境应使用正规的按量 API 认证。

## Album Engine 边界

购买渠道图标与 3D 无关。（历史说明：编写本文时生成算法还在宿主的 ~~`server/digital_twins.py`~~；之后已整体迁入可安装的 Album Engine 插件，宿主只保留插件生命周期与 `storage.py` 事务，见 D-004、D-005、D-017。）
