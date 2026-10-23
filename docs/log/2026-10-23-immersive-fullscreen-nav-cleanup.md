# 2026-10-23 · 沉浸展示全屏 + 底栏精简 + 禁止长按链接预览

- **作者**：Claude
- **范围**：`web/src/components/AppNav.tsx`、`styles/layout.css`、`styles/base.css`、`styles/gallery*.css`、`styles/gallery-orbit.css`、`gallery-stage.css`、`gallery-continuous.css`、`pages/GalleryPage.tsx`、`hooks/useImmersive.ts`、`hooks/useReducedMotion.ts`、`hooks/useAlbumLikes.ts`、`android/.../MainActivity.java`、`CHANGELOG.md`

## 改了什么
1. 底栏：删掉每项里多余的 `.tab-ico` 包裹层和对 `button` 的样式，徽标直接相对 `<a>` 定位；加 `-webkit-touch-callout:none`、`user-select:none`、透明点按高亮，并对所有 `a[href^="#"]` 禁用 iOS 长按链接预览。
2. 沉浸展示：主区 padding / `--gallery-main-top|bottom` 归零，展示舞台铺满视口；页头变成右上角 fixed 的悬浮「退出沉浸」（玻璃底），`useImmersive` 在 3 秒无操作后加 `.is-chrome-idle` 淡出，pointer / touch / key 事件唤回。沉浸逻辑从 GalleryPage 抽成 `hooks/useImmersive.ts`（并顺手抽出 `useReducedMotion`、`useAlbumLikes`，使页面文件回到 200 行以内）。
3. 安卓：`Bridge.setImmersive(boolean)` 用 WindowInsetsController（API 30+）/ systemUiVisibility（旧版）隐藏系统栏，沉浸中 `layoutInDisplayCutoutMode=SHORT_EDGES` 并不再为刘海留边；页面通过 `ObiAndroid.setImmersive` 调用，旧壳没有该方法时静默跳过。

## 出现的问题
用户反馈：底栏项里有多余容器 / 样式；长按底栏会弹出浏览器链接预览菜单；安卓沉浸时顶部仍显示状态栏；沉浸时顶部一大片空白没被利用。

## 怎么解决的
见上。长按预览是 iOS 对 `<a href>` 的默认行为（截图里是系统的「打开 / 添加到阅读列表 / 拷贝链接 / 共享」），用 touch-callout 关闭；WebView 里 `requestFullscreen` 不会隐藏系统栏，所以加原生桥。

## 可能带来的新问题
- 安卓原生部分只在 CI 里编译，未在真机验证；需安装新版安卓壳才生效。
- 沉浸时按钮淡出后，第一次触摸只是唤回按钮同时仍会点到下面的封面。
- 沉浸里按下面的「展示设置」等被隐藏，只能退出沉浸后调整（原本也是如此）。

## 关联
2026-10-23-nav-pill-transform.md
