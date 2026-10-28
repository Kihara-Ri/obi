# 2026-10-28 · 视觉模型接口挪到「账户 → 已连接服务」；OpenCode 网页登录回填密钥

- **作者**：Claude（Opus 5.5）
- **范围**：`web/src/pages/SettingsPage.tsx`、`web/src/pages/settings/AccountSettings.tsx`、`web/src/components/ListingSettings/`（新增 `OpenCodeLogin.tsx`）、`web/src/core/clipboard.ts`、`web/src/forms/ListingForm.tsx`、`android/`（新增 `Clip.java`，`MainActivity` 桥接 `clipboardText()`）、listing 浏览器验收、CHANGELOG / 使用说明 / 部署说明 / REGISTRY / D-030 补充。

## 改了什么

视觉模型接口从「高级」挪到「账户」，账户页分「登录与安全」「已连接服务」两块，服务商列表与详情页原样搬过去；仍只在开启二手交易时显示，未开时留一行指引。OpenCode 新增「用 OpenCode 账户登录」：打开 opencode.ai/auth，回到应用时读剪贴板回填密钥框（另有「粘贴」兜底），保存仍由用户点击。

## 出现的问题

用户反映安卓 3.11 上看不到视觉模型接口、也没有报错。在 API 35 模拟器上用正式发布的 3.11.0 安装包实测：全新安装与 3.10→3.11 覆盖升级，只要开着二手交易，OpenCode 都正常出现（中继检测、Service Worker 换新内容都正常）。唯一与「3.11、无报错、整块没有」吻合的是二手交易未开启——原代码此时整块静默隐藏，用户无从得知入口在哪。另：WebView 不授予 clipboard-read，网页里的 `navigator.clipboard.readText()` 读不到剪贴板；密码框禁止剪切，模拟器上改用 CDP 写剪贴板做验收。

## 怎么解决的

未开二手交易时显示一行「在功能里开启二手交易后出现在这里」的指引，代替整块消失。OpenCode 官方没有面向第三方应用的 OAuth（Go 文档只有 Console 密钥），所以不抓网页登录态、不冒充 OpenCode 客户端，只做「打开网页 + 回填密钥」。安卓壳新增 `ObiAndroid.clipboardText()`（UI 线程读第一条纯文本、限 4000 字，仅在用户操作后调用）；浏览器 / iOS 走 `navigator.clipboard.readText()`，失败时提示改用「粘贴」或手填。被放弃：`window.open`（WebView 关闭了 JS 自动开窗，改用 `<a target=_blank>`，沿用壳里已有的站外链接交给系统浏览器的路径）。

## 可能带来的新问题

原生改动，按 D-023 须随 3.12.0 次版本发布，不能当 3.11 补丁；未在真机验证，仅模拟器（API 35，debug 包）。iOS Safari 回到页面时自动读剪贴板通常会被拒（需手势），只能点「粘贴」。剪贴板文本只按「单行、20–300 个字符」判断像不像密钥，不校验格式。顺带修正两处既有问题：密钥说明按运行方式区分（服务器版「服务器的受限文件中」，本机版「这台设备的应用数据里」；完整备份只含照片 / 封面 / 实体文件夹，不含 credentials）；安卓壳里账户页不再提示「安装到主屏幕」。另修设置标签滑块在窗口变窄 / 旋转时短暂撑出横向滚动（`.settings-tabs` 裁剪）。模拟器上一次覆盖安装后首启白屏，强停重开即正常，判断为模拟器软件渲染卡顿，未在真机复现。

## 关联

D-013 · D-023 · D-029 · D-030（补充）· `2026-10-28-opencode-provider.md` · `2026-10-28-android-local-models.md`
