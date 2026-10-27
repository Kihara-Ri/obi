# 2026-10-26 · 收藏展示：巡游就地调速（5 档）、工具区与设置重排

- **作者**：Claude
- **范围**：`core/gallery.ts`（`roamingPace`、`galleryRoamingSeconds`、旧偏好迁移）、`components/GalleryRoamingControls.tsx`、`GallerySettings/`（删 `icons.tsx`）、`GalleryModePicker.tsx`、`pages/GalleryPage.tsx`、拆分 `GalleryContinuous.tsx` → `GalleryFilm` / `GalleryTable` / `GalleryIsometric` / `GalleryStageControls`、`GalleryOrbit.tsx`（共用箭头）、`styles/gallery*.css`、测试、AGENTS、REGISTRY、CHANGELOG

## 改了什么
用户逐项确认的方案：巡游开关旁的速度胶囊就地弹出 5 档倍率（所有布局共用，「标准」= 原默认秒数）；工具区两行精简（范围带张数、去小字标签、设置改齿轮）；布局抽屉三列 + 真实封面缩略图；展示设置每项一行 `Seg`；沉浸悬浮条加巡游控件；连续布局按文件拆开、箭头共用。

## 出现的问题
1. 原调速路径四层（开巡游 → 展示设置 → 滚到底 → 滚轮对话框），单位三种（秒 / 秒每张 / 秒每排），每布局各存一份。
2. `gallery.css`、`gallery-roaming.css` 末尾残留不成对的 `}` 与空选择器（旧改动遗留）。

## 怎么解决的
1. 偏好改为单一 `roamingPace`；读取时若无档位，用当前布局的旧秒数按倍率对数距离取最近档（例：唱片箱 3 秒 → 快）。被放弃：连续滑块（用户选 5 档）。
2. 两个 CSS 文件的控件段整体重写。
3. 范围 / 方式按钮仍不加向下箭头（原有约定：打开的是抽屉不是下拉），只有速度胶囊带 Chevron。

## 可能带来的新问题
- 旧的每布局秒数只迁移当前布局那一项，其他布局的个性化秒数不再保留（用户已选统一档位）。
- 浏览器原生全屏下按 Esc 会由浏览器直接退出全屏，速度浮层的 Esc 拦截只对非原生全屏有效。
- 已验证：typecheck / build / 156 项单测；样本库 375×812 工具区、速度浮层（选档、Esc、点外收起）、展示设置、布局抽屉、沉浸悬浮条，9 种布局切换均渲染，控制台零报错。巡游实际速度在隐藏的预览面板里受 rAF 限流未能目测，需真机感受档位差异。

## 关联
AGENTS「用户已定案的 UI 偏好」展示条目
