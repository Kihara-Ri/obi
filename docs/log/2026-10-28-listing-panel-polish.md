# 2026-10-28 · 上架页排版与展开/编辑重做

- **作者**：Claude
- **范围**：`ListingCopy`（重写，删除 `ListingCopyReader`）、`ListingPhotos`、`ListingForm.tsx/.css`、`PhotoDownload` 读取文案、`tests/browser/listing-reader-acceptance.mjs`、AGENTS / DECISIONS / 使用说明 / CHANGELOG / REGISTRY

## 改了什么
用户看实际截图后指出：编辑入口不明显、排版层级倒置、展开/收起不好用。按讨论的方案（就地展开、卡内编辑、预取不动）重做：
- 「售卖文案」成为正文级标题，状态徽标（已保存 / 未保存 / 编辑中 / 新文案）；空态卡内直接放「AI 生成上架资料」与「或手动编写」，不再显示孤立标题和 10rem 留白。
- 长文就地展开：clip 容器 max-height 过渡，下方内容顺势推下；收起条 sticky 吸在滚动区底部；点正文也能展开，选字不误触。
- 编辑态：卡内输入框，底栏换成「完成 / 保存草稿」，不再把保存按钮藏在编辑区里。
- 照片：缩略图自适应放大，加载骨架与失败态，复制图标叠在缩略图右下角，删掉伪链接与重复提示；底栏「保存图片」预取期间显示「读取照片…」。
- 分隔线只保留区块之间一条；正文区隐藏滚动条。

## 出现的问题
- 去掉 `.listing-reading-host` 后底栏被内容撑出屏外：`.drawer-body` 在 flex 列里缺 `min-height:0`，给 `.listing-body` 补上。
- 展开收起中途被判为「不超长」导致收起条消失：改用正文自然高度对比 `--listing-preview-max` 换算的像素，不读动画中的 clip 高度。
- 候选出现时若仍在编辑态会落到空态：`showText` 对候选放行。

## 怎么解决的
覆盖层方案（D-032 同日的上一版）被放弃：只有头部能收起，且要同时维护 inert / 焦点 / 滚动。就地展开没有这些状态。

## 可能带来的新问题
- 照片仍是原图当缩略图（无缩略图接口），4G 下首屏可能慢；骨架只是让等待可见，未减少流量。
- `listing-acceptance.mjs` 的照片 / 手机分享部分依赖联网下载的参考样本，本机没跑到（前半段文案、编辑、候选、预设、冲突流程已通过）；`listing-reader-acceptance.mjs`（Chromium，390 与 1280）通过。WebKit 与真机未验。

## 关联
D-032 · 2026-10-28-listing-copy-first.md · 2026-10-28-listing-copy-reader.md
