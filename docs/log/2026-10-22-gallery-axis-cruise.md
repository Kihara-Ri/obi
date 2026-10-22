# 展示滑动方向与巡游引擎（v3.6.0）

- 范围：`core/gallery.ts`（`axis` 偏好、`galleryHasAxis`）、`GalleryWall.tsx`、`GallerySettings`、`GalleryStage`、`useGalleryRoaming.ts`、`useGalleryMotion.ts`、`core/gallery-motion.ts`（`smootherstep` / `edgeEase`）、`styles/gallery-viewport.css`。
- 水平：舞台本身是横向滚动容器（`.is-axis-x`，始终带 `has-roam-viewport`）；`--axis-rows / --axis-cell / --axis-gap` 由 ResizeObserver 按舞台高度算；瀑布流水平时各「列」改成横行，整体一起横向滚动（垂直时的各列错速在水平方向取消）。
- 巡游引擎：进度 0→1 按 1.2 s 升、0.7 s 降（触碰 0.22 s），速度 = 全速 × smootherstep(进度)；只在「想动」与否之间切换，不瞬间启停。去掉窗口失焦、`#panel`/`dialog` 的打断，只保留全屏看图（`#lightbox`）、页面隐藏与减少动态效果。端点用 `edgeEase` 缓冲。等距模块（`useGalleryMotion`）加起步斜坡与关闭后沿用 coast 相位滑行。
- 改名：漫游 → 巡游（用户可见文案与文档；内部 class 名 `gallery-roaming-*` 不变）。
- 验证：Playwright 手机尺寸看了水平封面墙 / 瀑布流、起步与关停的 scrollLeft 曲线、四种其它布局开关巡游无报错；未在真机上看手感。
