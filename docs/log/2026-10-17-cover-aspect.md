# 2026-10-17 · 灯箱卡片按封面比例，缩略图空条铺模糊底

- **作者**：Claude
- **范围**：`components/{AlbumFlipCard,Cover,GalleryMedia,useCoverAspect}` `core/cover-aspect.ts` `styles/{album-flip-card,gallery-stage}.css`

## 改了什么
灯箱卡片不再固定正方形，按封面宽高比排版（高度不超过 72dvh），封面填满；封面墙等缩略图里非正方形封面的空条用同一张封面的模糊放大版铺底，只对偏离正方形超过 4% 的封面启用。

## 出现的问题
非正方形封面（如 1.1:1）在正方形卡片里露出上下深色条。

## 怎么解决的
封面加载时记录宽高比（缓存），卡片读取它设置 `--cover-ratio`；缩略图用 `--art-url` 伪元素模糊铺底，封面本身仍 contain，放大动画几何不变。

## 可能带来的新问题
卡片形状随专辑变化；模糊铺底在封面很多的墙上的手机帧率未实测；本提交未带入未提交的引擎预览改动（GalleryMedia 仅含本次改动）。

## 关联
见同日期其他日志
