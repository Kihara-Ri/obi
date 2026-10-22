# 燃烧显现稳定化（v3.6.8）

- 现象：有时看得到火烧，有时只闪一下，有时闪好几下。
- 原因（推断，本机复现了前两条）：动画由 `onLoad` 触发，加载快 / 缓存命中时在卡片还没进入视野或展开动画中就播完；`img.complete` 兜底路径不经 `burnReveal`，直接弹出；`key={tries}` 重挂与换备用封面时同一元素的 `dataset.burned` 标记导致只闪不烧。
- 改法：`ReleaseCandidateCard` 把「已加载」与「开始显现」分开：`loaded` 且占位已显示 ≥450ms 且头部（`expand.head`）IntersectionObserver ≥60% 可见，才 `setArtState('ok')`；`useLayoutEffect` 在 ok 提交后、绘制前调用 `burnReveal`（遮罩先于第一帧生效）。`<img key>` 改为 地址 + 重试次数，每张图只显现一次。
- 验证：Playwright 逐 60ms 采样，即时响应与 1.5 秒延迟两种情况都是「占位 → 遮罩动画 → 完成」，从未出现图在没有遮罩时可见。未在真机验证。

- v3.6.9：动画结束后多闪一下——推断是结束时 `setMask(null)` / 移除 `mix-blend-mode` 叠加层触发图层重绘（iOS 常见）。改为 `finish()`：遮罩换成全不透明最后一帧并保留，余烬层 opacity 淡出 180ms 后移除；`cleanup()`（撤遮罩）只用于出错或元素已被移除。rAF 暂停的兜底也走 `finish()`，`tick` 在完成后不再改遮罩。本机只能验证遮罩保留、无多余状态跳变，闪烁本身需真机确认。
