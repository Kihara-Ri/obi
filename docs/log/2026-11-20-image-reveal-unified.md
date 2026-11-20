# 2026-11-20 · 全站图片统一「模糊到清晰」显现

- **作者**：Claude
- **范围**：
  - 新增 `web/src/core/image-reveal.ts`；`web/src/core/cover-reveal.ts`、`web/src/main.tsx`
  - `web/src/styles/components.css`（去掉 `.cover-reveal` 类与封面淡入 transition）
  - `web/src/components/ui/Lightbox.tsx`、`ui/LightboxSlide.tsx`
  - 加 `data-no-reveal`：`AppNav.tsx`、`ShopField.tsx`、`LookupProgress.tsx`、`GalleryFocus.tsx`、`ReleaseCandidateCard.tsx`、`core/cover-fly.ts`

## 改了什么
- 原来只有查询页的专辑封面和版本卡片是「透明、模糊 → 清晰」显现；库存封面是 0.2 秒淡入，其他图片（实物照片、艺人页封面与头像、表单缩略图、灯箱大图等）直接蹦出来。
- 现在统一：启动时在文档上装一个监听，**任何图片从网络读完时**都播这个显现（约 0.38 秒）。插入页面时已在缓存里的图直接显示，不播；每张只播一次；减少动态效果时直接显示。
- 显现改用 Web Animations 播放，不再加 CSS 类：React 重渲染改 `className`（封面读完加 `is-ready`）会把 CSS 类抹掉、动画中途被打断，WAAPI 不受影响。
- 灯箱：点开时图已读好，照旧从缩略图放大；还没读好，转圈等待，读完原位模糊到清晰，不再补播放大。
- 不参与的图加 `data-no-reveal`：品牌 logo、店铺图标、查询来源图标、展示页放大过渡用的替身图、移除专辑时飞走的克隆图；查询版本卡片自己管显现时机，也排除在全局之外（效果相同）。

## 出现的问题
- 用户要求所有加载图片的效果统一成查询里的模糊变清楚。

## 怎么验证的
- 预览：让库存封面重新从网络读取，冻结在动画不同时刻截图，能看到由模糊到清晰；已缓存的图不播。
- 前端单测、类型检查、构建、后端测试、文档检查、浏览器验收通过。

## 可能带来的新问题
- 首次打开、封面很多的页面会同时播多张模糊动画，低端手机上可能稍卡。
- 新增的图标类 `<img>` 若不想要这个效果，需要记得加 `data-no-reveal`。
