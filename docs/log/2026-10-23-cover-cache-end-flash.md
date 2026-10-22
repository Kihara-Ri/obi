# 2026-10-23 · 封面结束闪烁与折叠缓存（v3.6.9 / v3.6.10）

- **作者**：Claude
- **范围**：`web/src/core/burn-reveal.ts`、`web/src/components/ReleaseCandidateCard/ReleaseCandidateCard.tsx`；构建产物 `static/assets/*`（重新构建的噪声）。工作区里 `web/src/forms/detail/FlowSection.tsx` 的改动不是这次所做，未触碰。

## 改了什么
燃烧显现结束时不再撤掉遮罩，改留全不透明的最后一帧、余烬层淡出后移除；查询页卡片记住本次运行里加载成功过的封面，折叠再展开直接显示、不重播动画。

## 出现的问题
用户反馈：动画结束会多闪一下才出现封面；反复折叠 / 展开每次都重新「找封面…」并重播燃烧。

## 怎么解决的
- 闪烁：推断是结束时 `setMask(null)` 与移除 `mix-blend-mode` 叠加层触发图层重绘（iOS 常见）。改为 `finish()` 保留不透明遮罩；rAF 暂停的兜底也走 `finish()`，`tick` 完成后不再改遮罩。放弃的方案：延迟撤遮罩（仍有一次图层变化）。
- 缓存：折叠会卸载卡片，状态清零。模块级 `loadedArt`（地址 → 保活 `Image`，上限 120）记住已加载封面，挂载命中则初始为 `ok` 并标 `dataset.burned` 跳过动画。放弃的方案：持久化到 localStorage / Cache API（先看内存缓存效果）。

## 可能带来的新问题
- 缓存只在当前页面运行期内有效，刷新或重开 app 后首次仍要请求。
- 遮罩常驻在封面 `<img>` 上，放大动画 / 极端设备下的渲染表现只在 Playwright 验证，未在真机确认；闪烁是否消失需真机验证。
- 已验证：typecheck、146 个前端测试、CI 通过；本机采样确认遮罩保留、再次展开 20 帧均直接可见。

## 关联
2026-10-23-burn-reveal-stable.md · 2026-10-23-cover-fallback-mb-retry.md
