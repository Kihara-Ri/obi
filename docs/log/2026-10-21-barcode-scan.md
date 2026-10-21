# 2026-10-21 · 条码相机扫码

- **作者**：Claude
- **范围**：`web/src/components/BarcodeScanner/`、`core/barcode-detector.ts`、`pages/LookupPage.{tsx,css}`、`forms/record/ReleaseLookupSection.{tsx,css}`、`useReleaseLookup`（导出 `search`）、`package.json`

## 改了什么
- 全屏扫码层：`getUserMedia` 后置摄像头 → 每 160ms 识别一帧 → 取第一个通过 GS1 校验位的条码 → 震动一下、回调、关闭相机。
- 识别器：原生 `BarcodeDetector` 优先；没有（iPhone Safari）时动态加载 `barcode-detector/ponyfill` + zxing-wasm，wasm 用 Vite `?url` 打进 `static/assets`，`locateFile` 指向本站（CSP `connect-src 'self'`，已有 `unsafe-eval` 允许 wasm 编译）。首次扫码才下载（约 0.9MB，gzip 约 0.4MB）。
- 入口：「查询」页表单、专辑表单发行版输入行各加相机按钮；扫到后直接按条码查询。
- 相机失败（无 HTTPS、拒绝权限、无摄像头）给一句原因，可返回手动输入。

## 验证
- 浏览器：伪造 `getUserMedia`（canvas 画一个有效 EAN-13），点扫码按钮后自动识别、关闭扫码层、输入框填入条码并发起查询。
- 没在真实 iPhone 相机上测（对焦、光线、识别速度以真机为准）；iOS 需 HTTPS 与相机权限，线上站点满足。

## 追加：入口改为嵌在输入框里的扫码图标
独立的相机按钮又占位又歪（图标沿用 14px 的 `CamIco` 却被放大到 20px，溢出偏位）。改为 `ScanField`：输入框右端嵌一个 36px 的扫码图标（取景框 + 中线），不再单独一格；状态行「找到 N 个版本」前的「…」改成显示数量的圆标。浏览器（手机宽度）确认图标在框内、文字左对齐。
