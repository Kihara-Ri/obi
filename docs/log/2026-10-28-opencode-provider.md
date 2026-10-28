# 2026-10-28 · 售卖照片识别接入 OpenCode（Beta）

- **作者**：OpenCode agent（DeepSeek V4.1 Flash）
- **范围**：`server/listing_provider_config.py`、`server/listing_providers.py`、`server/listing_model.py`、`server/listing_transport.py`、`web/src/components/ListingSettings/`、`web/src/core/listing.ts`、售卖验收脚本、部署说明 / 使用说明 / README / AGENTS / D-029。

## 改了什么

新增独立服务商 `opencode`：设置页填 OpenCode Console API Key，选 Go 订阅或按量余额；目录取 `<base>/v1/models`，分析走 `<base>/openai/v1/chat/completions` 并带 `x-opencode-session`。通道进入身份指纹，目录与选择互相隔离。界面标 Beta；403 时显示「可能仅限 OpenCode 客户端使用，或工作区未授权此模型」。

## 出现的问题

OpenCode 不返回 CORS 头；目录不返回图片与思考强度元数据；免费档模型对其他客户端返回 403。

## 怎么解决的

按 D-013 的口径保留「未声明」，不按模型名猜能力；403 文案按调用方覆盖；通道隔离与模型选择用单元测试锁定。安卓本机模式另走原生中继，见 `2026-10-28-android-local-models.md`。

## 可能带来的新问题

未用真实 OpenCode 账户验收图片输入；Go 的额度 / 用途限制需按官方说明；接口变化时可能需要调整。界面已标 Beta。

## 关联

D-013（补充）· D-029 · D-030
