# 2026-10-23 · 扫码画面改用 canvas 渲染（避开原生视频层）

- **作者**：Claude
- **范围**：`web/src/components/BarcodeScanner/BarcodeScanner.tsx`、`BarcodeScanner.css`、`CHANGELOG.md`

## 改了什么
`<video>` 变成只解码的 `.scan-decoder`（2×2px、opacity .01，放在角落）；新增 `drawFrames()` 用 `requestVideoFrameCallback`（无则 rAF）把帧按 cover 方式画到全屏 `<canvas class="scan-video">`，显隐 / 淡入仍由 `shown` 控制。识别仍直接读 video。不透明黑底保留。线上先用 `tools/deploy.sh --rollback` 退回了 v3.6.15。

## 出现的问题
v3.6.16（不透明黑底）发布后用户判断仍有闪一下的方框，应是浏览器原生视频层的问题，要求先回滚再改。

## 怎么解决的
原生 video 层在出画前 / 尺寸切换时可能按自己的默认尺寸合成一两帧，CSS 的 opacity 并不总能压住它；canvas 是普通合成图层，没有这个问题。放弃继续调 video 的显现时机：治标。Chromium 假摄像头验证：解码器 1920×1080 在播，canvas 读回像素为摄像头颜色，逐帧顺序为黑底 → 画面淡入。

## 可能带来的新问题
每帧一次 drawImage，低端机会多一点 CPU / 电量；iOS 对近乎不可见的 video 可能降频或暂停解码（用 opacity .01、2px 规避，未在真机验证）；若出现画面卡住需改为把 video 放在可见区域下方。回滚的 v3.6.16 的 tag 与 GitHub release 仍保留。

## 关联
2026-10-23-scan-backdrop-opaque.md · 2026-10-23-scan-open-transition.md
