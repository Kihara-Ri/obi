# 2026-10-19 · 宿主 CI 不再验收 3D 动作

- **作者**：Claude
- **范围**：`web/tests/browser/showcase-acceptance.mjs`、`web/tests/browser/README.md`、`.github/workflows/ci.yml`

## 改了什么
宿主 CI 的“真实封面与模型贴图浏览器验收”不再等待 3D 展开、键盘旋转、CD 2 取出/收回；任务时限由 40 分钟恢复为 25 分钟。

## 出现的问题
3D 已拆到 Album Engine，但宿主 CI 仍在 GitHub 无显卡机器上用软件渲染等这些动画，每帧数秒，300 秒内常常走不完（同一份代码 8 次中仅 1 次全绿），使与 3D 无关的提交也无法发版。

## 怎么解决的
按“3D 行为只在引擎项目验收”的边界收窄：宿主保留引擎挂载与资产相关检查——默认/重开 2D、按需请求 GLB、查看器进入 WebGL、全部贴图请求成功且逐份比对 SHA-256、画布铺满视口、上下文丢失回 2D 与显式重试、关闭后清理 GPU 资源，以及 2D 翻转卡、金银材质、HDR、减少动态效果。被放弃的方案：继续加大超时（已试 90s→300s 仍不稳）。

## 可能带来的新问题
宿主不再兜底引擎的 3D 动作回归，需引擎项目自己的 CI 覆盖。已从宿主移走、建议在引擎项目验收的检查：
- 选中模型后按 Enter 展开，`data-rendered-open` 在合理时间内达到 > 0.98。
- 展开后按 ArrowRight，包装 `data-yaw` 改变（键盘旋转）。
- Lift Your Skinny Fists（2CD）：按 2 取出第 2 张盘（`data-disc=2`、`data-disc-progress` > 0.98），再按 ArrowRight 时只有盘的 `data-disc-yaw` 变化、包装 yaw 不变；再按 2 收回（进度 < 0.01）。
- 对应的软件渲染等待与失败现场输出（`[open-diag]`、`[disc-diag]`）一并移走。
- 已验证：见同日提交的 CI 结果。
