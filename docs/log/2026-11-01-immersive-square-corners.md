# 2026-11-01 · 沉浸展示全屏去掉圆角与贴边描边

## 问题

用户截图（普通展示 → 沉浸展示）指出：进入沉浸后画面已经铺满整屏，但屏幕四角仍是圆的。

定位：舞台容器 `.gallery-stage` 带 `border-radius:var(--radius)`（14px）。普通展示里它被页面内边距内缩，这圈圆角是卡片外观；
沉浸态 `#main.showcase-main` 的 padding 归零，舞台铺满整屏，同一个圆角把屏幕四角裁成圆弧并露出页面底色。
截图实测圆弧半径约 40 设备 px（DPR 3 ≈ 13.4 CSS px），与 `--radius` 吻合，不是设备屏幕的物理圆角。

顺带发现同一类问题：环形展架 / 等距封面墙 / 桌面铺开 / 胶片在沉浸态也铺满屏幕，各自还带 1px 描边（胶片是 7px 圆角），会贴着屏幕边缘留一圈线。

用户确认的范围：只去掉舞台容器的圆角（封面自身 3px 圆角保留），且所有布局一起处理，包含贴边描边。

## 改动

只在沉浸态生效，普通展示的圆角卡片外观不变：

- `web/src/styles/gallery-stage.css`：`.gallery-page.is-immersive .gallery-stage{border-radius:0}`（封面墙 / 瀑布流 / 桌面铺开 / 中心布局的舞台根元素）。
- `web/src/styles/gallery-continuous.css`：沉浸态下 `.gallery-isometric-shell`、`.gallery-stage--table`、`.gallery-film-rail` 的 `border:0;border-radius:0`。
- `web/src/styles/gallery-orbit.css`：沉浸态 `.gallery-orbit-space` 的既有覆盖补上 `border:0;border-radius:0`（断点规则只覆盖高度，不冲突）。

背景（木纹桌面、展架与斜列的光晕）保留，只去掉圆角与贴边描边；封面自身的 3px 圆角与灯箱、悬浮条不受影响。

## 验证

- `npm --prefix web run typecheck`、`npm --prefix web run build` 通过，`static/assets` 已重新构建。
- 浏览器实测（Chromium 1.64.1，390×844 与 844×390，DPR 3，固定样本库 21 副本 + 真实封面，独立数据目录 `/tmp/obi-covers`，端口 8798）：
  - 普通态 `.gallery-stage` 计算值仍为 `border-radius:14px`（卡片外观无回归）。
  - 沉浸态九种布局（封面墙、瀑布流、胶片、桌面铺开、等距封面墙、环形展架、翻阅、唱片箱、扇形展开）的舞台 / 展架 / 桌面 / 胶片条计算值均为 `border-radius:0px`、`border-width:0px`，舞台矩形等于视口（竖屏 390×844、横屏 844×390，起点 0,0）。
  - 截图确认封面铺到屏幕四角、环形展架四周不再有描边；console / page error 为 0。
- 灯箱、抽屉、沉浸悬浮条（`gallery-immersive-bar`）未改，圆角仍在。

## 范围外

工作区既有未提交改动里 `storage.py` 曾新增 `from server import photo_uploads`，使「先导入 storage」的入口（如 `tools/seed_samples.py`）触发循环导入；
`app.py` 启动路径正常。本次验收用先 `import server` 的临时入口灌样本，当时未修改该处。
该导入环已在同日修掉：照片暂存模块移到根目录 `photo_uploads.py`，见 [2026-11-01-photo-staging-root-module.md](2026-11-01-photo-staging-root-module.md)。
