# 2026-10-21 · 识别服务商：列表 + 详情页

- **作者**：Claude
- **范围**：`server/listing_{providers,provider_config,routes,model}.py`、`routes.py`、`web/src/components/ListingSettings/*`、`core/listing.ts`

## 背景
参考另一应用的 DeepSeek 服务商页面（头部状态、三步进度、密钥/模型/测试分区）重做「售卖照片识别」设置。原先是一个下拉框切换通道，配置一个服务商就会同时切换"在用"通道。

## 做法
- 设置页只放服务商列表（连接 / 已通过测试 / 分析在用 标记），点进详情抽屉。
- 详情页：头部徽章 + 三步（密钥或授权 / 选模型 / 测试连接）；密钥区只显示末四位，可更换、移除；模型区可刷新目录、选模型与思考强度；测试区调用新接口 `POST /api/listing/test`（读取模型目录，结果与时间存入受限配置，换密钥/断开即清除）。
- `GET /api/listing/status?provider=` 可查看某个服务商而不切换"在用"；"设为分析在用"需先连接并选好支持图片的模型。
- 状态新增 `inUse`、`keyTail`、`keySource`、`tested`，不回传密钥。

## 验证
后端新增 `ProviderPageTests`；前端 typecheck 通过。未用真实 DeepSeek 密钥走完整流程。
