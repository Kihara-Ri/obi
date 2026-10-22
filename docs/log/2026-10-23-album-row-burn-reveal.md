# 2026-10-23 · 专辑行封面也用燃烧显现

- **作者**：Claude
- **范围**：`web/src/pages/AlbumResults.tsx`、`pages/LookupPage.css`、`CHANGELOG.md`

## 改了什么
文字搜索结果里每个专辑行的封面（父级）在加载完成时调用 `burnReveal`，此前只有展开后的版本卡片有动画，父级封面直接出现。

## 出现的问题
用户反馈：版本卡片有燃烧过渡，专辑行封面没有。

## 怎么解决的
img 初始 `opacity:0`，`onLoad` 里先挂遮罩开始动画再设为可见（同一同步回调，避免闪一帧完整封面）；模块级 `revealed` 集合记录已烧过的地址，折叠 / 重渲染后直接显示；`.ah-art` 加 `position:relative` 让余烬画布定位。没有复用卡片里的 450ms 最短停留 / 进入视口门控：行封面本身是 `loading="lazy"`，进入视口才会加载。

## 可能带来的新问题
懒加载图片在已缓存时加载极快，动画可能紧接着播放；封面加载失败仍回退为占位。仅 Playwright 验证，未在真机验证。

## 关联
2026-10-22-cover-burn-reveal.md · 2026-10-23-burn-reveal-stable.md
