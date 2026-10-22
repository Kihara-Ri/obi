# 安卓 v3.4.0：主摄、手动更新按钮、切页方向

- **范围**：`web/src/components/BarcodeScanner/`、`AppUpdateSection/`、`web/src/hooks/usePageTransition.ts`、`android/.../Updater.java`、`MainActivity.java`（新增 `installUpdate` 桥接）、`CHANGELOG.md`

## 改了什么
- 相机：`facingMode: environment` 在多摄手机上常落到长焦。拿到权限后用 `enumerateDevices` 找后置镜头，排除标签含 tele / zoom / ultra / wide 的，取标签编号最小的（主摄通常是 camera2 0），不是当前轨道就换流；失败沿用系统默认。
- 手动检查更新：下载好后只置 `manualHold`，设置页出现「安装 x.y.z」按钮，点后 `installUpdate()` 才装；自动检查的行为不变。
- 切页方向：以展示为主时底栏是「展示 · 收藏 · 更多」，展示在收藏左边，但页面方向表里展示排在收藏右边。`rankOf` 在该模式下把展示排到最左。

## 怎么验证的
- 切页方向：Playwright 手机尺寸，展示为主：展示→收藏用 `page-in-right`，收藏→展示用 `page-in-left`。
- 安卓：debug 包编译通过；模拟器验证了自动检查下载并弹确认框。手动检查按钮与点击安装没能在设备上完整走通（调试桥脚本多次挂起），只做了代码审查；镜头选择未上真机。

## 可能带来的新问题
- 镜头标签因厂商而异，启发式可能选错；选错时点取消重开不会改善，需要真机反馈再调。
- 本次改了原生桥接，所以是 v3.4.0（次版本），按 D-023 不能当补丁发。
