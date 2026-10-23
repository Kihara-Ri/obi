# 2026-10-23 · 沉浸过渡：所有封面一起动

- **作者**：Claude
- **范围**：`web/src/core/view-swap.ts`、`styles/gallery.css`、`CHANGELOG.md`

## 改了什么
`viewSwap` 不再只给一张「主角」封面命名，而是给屏幕内（上下各留四分之一屏余量）每张 `.gallery-artwork` 都分配唯一的 `view-transition-name`（图片地址哈希 + 第几次出现）和 `view-transition-class: gallery-hero`；切换前后各标记一次，按名字配对，浏览器逐张做位置与尺寸形变；只存在于一边的封面淡入 / 淡出。动画时长用 `::view-transition-group(*.gallery-hero)` 统一设 0.6s。

## 出现的问题
上一版只有最靠近中心的一张封面有动画，其余都是交叉淡化，用户反馈不对。

## 怎么解决的
见上；12 张封面的手机尺寸逐帧截图确认整面封面墙一起移动，结束后无残留命名。

## 可能带来的新问题
- 每张封面一个过渡层，屏幕内封面特别多时（密集小格）过渡开始那一帧会更重。
- 不支持 `view-transition-class` 的浏览器退回默认 0.25s 时长。

## 关联
2026-10-23-immersive-view-transition.md
