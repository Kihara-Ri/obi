# 2026-10-23 · 巡游按钮样式统一

- **作者**：Claude
- **范围**：`web/src/components/GalleryRoamingControls.tsx`、`styles/gallery-roaming.css`、`web/tests/gallery-roaming-switch.test.mjs`、`CHANGELOG.md`

## 改了什么
巡游开关复用 `.gallery-adjust-trigger`（与「展示设置」同款），前面的空心圆点换成 14px 播放 / 暂停 SVG（关闭 = 播放，开启 = 暂停，颜色用 `--accent-deep`）；删掉药丸形的边框 / 底色样式，只保留开启色与禁用态。测试同步。

## 出现的问题
工具栏里只有它是带边框的药丸 + 圆点，与「范围 / 方式」的方块和「展示设置」不一致，显得违和。

## 怎么解决的
见上；手机尺寸截图对比关闭 / 开启两态。

## 可能带来的新问题
- 「巡游」只靠图标与颜色区分开关状态，辅助技术仍靠 `aria-pressed`。

## 关联
2026-10-23-immersive-view-transition.md
