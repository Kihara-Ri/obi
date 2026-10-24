# 2026-10-24 · 沉浸动画改为舞台伸缩、封面间距可调、沉浸原生代码抽类

- **作者**：Claude
- **范围**：`web/src/core/stage-expand.ts`（新，取代 `view-swap.ts`）、`hooks/useImmersive.ts`、`pages/GalleryPage.tsx`、`styles/gallery.css`、`styles/gallery-stage.css`、`core/gallery.ts`、`components/GalleryWall.tsx`、`components/GallerySettings/`、`android/.../ImmersiveMode.java`（新）、`MainActivity.java`

## 改了什么
1. 进出沉浸不再用 View Transitions（它把每张封面抬到页面最上层的合成层，退出时会盖住别的控件、切层时掉帧）。改为展示舞台容器自己用 transform 位移 + clip-path 裁剪伸缩：进入时舞台从旧位置向上长到整屏，退出时在沉浸版式里缩回原位，结束再切回普通版式。控件区原地淡出 / 淡回。
2. 去掉沉浸时「退出」按钮上方那条模糊渐变（手机顶栏的 `.page-head::before`）。
3. 展示设置新增「封面间距」（贴紧 / 小 / 标准 / 大），作用于封面墙与瀑布流，存在浏览器偏好 `spacing`，缺省为标准。
4. 沉浸的原生代码从 `MainActivity`（716 行）抽成 `ImmersiveMode` 类，顺手合并重复的隐藏标志、去掉被包含的 `statusBars|navigationBars`、修正过期注释。行为不变。

## 出现的问题
旧动画的层级切换导致遮挡与卡顿；沉浸原生代码散在一个大类里，且夹带多处未被证明有用的试探性标志。

## 怎么解决的
动画只动一个容器，不涉及 z-index：两端用同一锚点（居中布局对齐中心，其余对齐上缘），切换版式的那一帧画面连续。退出前临时摘掉沉浸类同步量出目标位置（不触发绘制）。减少动态效果时直接切换。试探性标志（NO_LIMITS、华为刘海反射、两次延迟重申）暂时保留，等真机结果出来再删。

## 可能带来的新问题
动画只在软件渲染的模拟器上看过位置，流畅度需真机评估；封面墙很高时裁剪窗口取屏幕内可见部分；系统栏隐藏过程中视口高度会小幅变化，动画终点可能有几十像素偏差；横竖屏切换中途退出会无动画直接退出。

## 关联
android-immersive-root-cause.md · 2026-10-23-immersive-view-transition.md（已被取代）
