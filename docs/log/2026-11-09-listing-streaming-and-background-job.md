# 2026-11-09 · 闲鱼上架文案流式生成、后台持久化与元数据打通

- **作者**：Antigravity
- **范围**：`server/listing_prompts.py`、`server/listing_model.py`、`server/listing_transport.py`、`server/listing_copy_clean.py`、`server/listing_generation.py`、`server/listing_analysis.py`、`server/listing_routes.py`、`web/src/core/listing.ts`、`web/src/forms/useListingTask.ts`、`web/src/forms/ListingForm.tsx`、`web/src/components/ListingCopy/`、单元测试及文档。

## 改了什么

1. **文案口吻与元数据打通**：
   - 彻底去除“资料标注”、“本副本记录为”等系统审计/后台痕迹，设定为个人闲置卖家真实交流口吻。
   - 唱片包装英文转为中文通通称（如 Jewel Case 转为胶盒/普通盒，Digipak 转为纸套，OBI 转为带侧标）。
   - 交易说明温和真诚，禁止生硬霸王条款；绝不擅自承诺打包材料（如纸箱气泡膜）或发货方式。
   - 底层注入完整的结构化版本与发烧元数据（`edition`、`format`、`pressing`、`matrix`、`obi`、`extras`、`packaging`），并在 Prompt 中引导详尽列出。
   - 有实物照片时自然交代实物品相（“成色如图所见即所得”），避免整段留白。
   - 清洗阶段兜底过滤系统痕迹词。

2. **后台任务持久化与断线重新接管（Re-attach）**：
   - 服务端任务提交至独立后台线程池运行，与前端 HTTP 生命周期完全解耦，手机退出应用或锁屏不受影响。
   - 后端 `/api/listing/job` 支持直接按 `recordId` 查询当前专辑的活动任务。
   - 前端打开抽屉时自动执行 `attach`，若后台正在运行则立即无缝接管轮询与进度展示；若已跑完则自动拉取定稿或呈现候选。
   - 写入阶段采用 SQLite WAL 原子事务并受 `_check_generation` 资料版本校验保护，进程意外退出不留脏数据。

3. **全链路 Agent 流式传输（Streaming）**：
   - 调用模型 API（DeepSeek / OpenAI）开启 `stream: True`，首字延迟降至毫秒级。
   - 标准库实现 SSE 流式接收器 `stream_chat_text`，并在接收中逐 chunk 增量提取 `title` 与 `description`。
   - 写作阶段 Worker 实时更新 `job.stream`，前端以 150ms 极速轮询实时更新。
   - 前端文案卡片支持打字机实时动态渲染及呼吸闪烁光标 `▍`。

## 验证

- `python3 tools/run_tests.py`：后端 620 项单元测试全部通过。
- `npm --prefix web run typecheck && npm --prefix web run build`：TypeScript strict 零报错，产物正常构建。
- `python3 tools/check_docs.py`：文档治理检查通过（25 个文件，0 处问题）。
- `tools/check-data-leak.sh`：暂存区与工作树数据泄漏检查通过。
