# 2026-11-18 · 设计系统与 PWA 防线

- **作者**：Claude
- **范围**：`docs/PWA与触屏规范.md`（新）、`web/tests/pwa-guards.test.mjs`（新）、`web/src/styles/photos.css`、`AGENTS.md`、`docs/README.md`、`CHANGELOG.md`；仓库外：Claude 设计系统「Obi 设计系统」

## 改了什么
把界面整理成一套 Claude 设计系统（颜色、字体、间距、圆角、投影、层级 token，10 个组件，动效与 PWA 两节）；把手机网页上踩过的坑写成 `docs/PWA与触屏规范.md`，能机检的 9 条写进 `pwa-guards.test.mjs`。

## 出现的问题
- 测试初版误报：`.select-all` 被当成 `select`；抽屉里小于 16px 的输入框；已在 `(hover:none)` 里复位的 `.card:hover`。
- 查出一处真问题：`.photo-strip a:hover img` 的放大不在 `(hover:hover)` 里，触屏点完会停在放大状态。
- `.impeccable.md` 第 6 条写「多指缩放和系统边缘返回保留」，与现行代码（整页禁缩放、拦截左缘返回）不一致；规范文档里注明「多指缩放」指展示布局内部的捏合，原文未改，待用户定。

## 怎么解决的
- 选择器正则收紧到独立的 `input/textarea/select` 词；抽屉里的输入框按 useFloatingFields 接管豁免；`(hover:none)` 里复位过的选择器不算。
- photos.css 把缩略图放大挪进 `@media (hover:hover) and (pointer:fine)`。
- `color-mix()` 在 sales.css 的标签淡底里仍在用，只影响装饰，规范写为「只许用于丢了不影响阅读的装饰」，不加机检。

## 可能带来的新问题
机检只证明防线还在，不证明手感；刘海位置、慢划返回、键盘、长按菜单、安卓返回键本次没有真机验证。设计系统作品是仓库外的副本，token 以 `web/src/styles/tokens.css` 为准，改 token 后需要同步。

## 关联
D-023 · 2026-10-24、2026-10-28 抽屉与键盘日志
