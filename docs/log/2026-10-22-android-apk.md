# 安卓安装包与应用内反馈入口（v3.1.0）

- **作者**：Claude
- **范围**：`android/`（新）、`.github/workflows/android.yml`（新）、`web/scripts/build-local.mjs`、`static/local/boot.js`、`web/src/components/FeedbackSection/`（新）、`web/src/pages/SettingsPage.tsx`、`web/src/components/REGISTRY.md`、`README.md`、`部署说明.md`、`CHANGELOG.md`、`docs/DECISIONS.md`

## 改了什么
- 新增安卓外壳：WebView 从 assets 提供 `dist-local/`，源地址固定为 `https://appassets.androidplatform.net/`；`ObiAndroid` 桥把分享 / 下载的文件写入 MediaStore；文件选择带相机；相机权限；外部链接与 `target=_blank` 交给系统浏览器；返回键；系统栏留白与深浅色。
- `android.yml`：Release 发布后构建签名 apk，校验固定证书指纹，上传 `Obi-<tag>.apk` 与 `.sha256`；也可对已有 tag 手动补发。签名密钥存为仓库 secret。
- 本机模式构建写入 VERSION（「版本」不再是 dev）；`sw.js` 末尾带 precache 版本注释，内容变了 SW 必然更新；`boot.js` 发现新 SW 时等它接管后重载，升级后第一次打开就是新版本。
- 「设置 · 高级」加「反馈问题」：打开 GitHub 新建 issue，正文预填版本、运行方式（安卓应用 / 本机模式 / 服务器）与 UA，不附带业务数据。

## 出现的问题
- Playwright `connectOverCDP` 连 WebView 报 "Browser context management is not supported"，改用 `_android` API 驱动模拟器里的 WebView。
- 升级后首次打开仍是旧版本：SW 文件字节不变时浏览器不会更新，旧 SW 继续提供旧缓存。
- 签名配置路径乱码：`Properties` 默认按 ISO-8859-1 读，仓库路径含中文；改为 UTF-8 读取并按配置文件目录解析相对路径。
- `OBI_APP_VERSION` 用非数字版本时 versionCode 为 0，验证时改用 `v3.0.1-probe` 这类版本号。

## 怎么解决的 / 验证
- 在 Android 15 模拟器（WebView 124）上验证：首次启动进入功能选择；下载完整备份落到 `Download/Obi`；「提交问题」在系统浏览器打开预填 issue；`install -r` 覆盖安装后数据保留；升级后首次打开即显示新版本；正式签名包全新安装可用，`apksigner` 证书指纹与 CI 校验值一致。
- 后端 465 项、前端契约测试、typecheck、构建、泄漏扫描全部通过。本机没有 Docker，未跑 `docker compose build`（Dockerfile 与 COPY 清单未改，`android/` 已加入 `.dockerignore`）。

## 可能带来的新问题
- 签名密钥（`data/android/obi-release.jks` 与 `signing.properties`）必须另行备份；丢失后已安装用户无法覆盖升级。
- 本机模式「更多」页底部仍写「数据保存在服务设备」，在手机上不准确（未改）。
- 下载备份时应用内提示与系统 Toast 会各出现一次。
- WebView 版本由系统更新，过旧的 WebView（低于 Pyodide 要求）可能无法启动。

## 关联
D-019 · D-021 · I-012
