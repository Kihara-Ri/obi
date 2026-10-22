# 安卓自动更新、服务器补丁 15 分钟检查、本机模式文案（v3.2.0）

- **作者**：Claude
- **范围**：`android/app/src/main/java/io/github/kihara_ri/obi/`（`Updater`、`UpdateJob`、`UpdateReceiver` 新增，`MainActivity`）、`android/app/src/main/AndroidManifest.xml`、`android/app/src/debug/`（新）、`android/app/src/main/assets/bridge.js`、`web/src/components/AppUpdateSection/`（新）、`web/src/components/REGISTRY.md`、`web/src/core/download.ts`、`web/src/components/DownloadButton.tsx`、`web/src/components/PhotoDownload/PhotoDownload.tsx`、`web/src/components/AppNav.tsx`、`web/src/pages/MorePage.tsx`、`web/src/pages/SettingsPage.tsx`、`web/src/pages/settings/BackupSection.tsx`、`deploy/obi-update.timer`、`.github/workflows/ci.yml`、`README.md`、`使用说明.md`、`部署说明.md`、`CHANGELOG.md`、`docs/DECISIONS.md`

## 改了什么
- 安卓应用自更新（D-022）：打开时 + 后台每 30 分钟查 GitHub 最新正式 Release，下载 `Obi-<tag>.apk`，校验 SHA-256 / 包名 / 版本 / 签名证书后用 PackageInstaller 安装。Android 12+ 允许「安装未知应用」后无需确认；使用中不打断，离开应用或后台时安装。设置「高级」新增「应用更新」。
- 服务器补丁更新器定时器：每天 08:00 → 每 15 分钟（带 2 分钟随机错峰）。
- v3.1.0 遗留的小问题：下载 / 保存后系统 Toast 与页面提示重复 → 只留页面提示并写明保存位置；本机模式「数据保存在服务设备」→「数据只保存在这台设备上」；本机模式备份卡片不再显示服务器快照与「另行备份数据目录」。
- CI 新增 `docker compose build` 与安卓 `assembleDebug` 两个 job（本机没有 Docker，之前没法验证镜像构建）。

## 出现的问题
- 后台任务里下载好了却没安装：安装又被投递到异步线程，任务先结束，进程随即被系统冻结。改为后台任务里同步提交安装会话。
- 测试时 `am force-stop` 会取消 JobScheduler 任务（下次打开应用重新排程）；撤销「安装未知应用」权限时系统会结束应用进程。两者都是系统行为，写进 D-022 代价。

## 怎么验证的（Android 15 模拟器，debug 包 + 本机测试更新源）
- 首次（未授权）：3.1.1 打开即下载 3.1.2 并弹窗 → 系统「允许此来源」页 → 允许后回到应用（此时仍是 3.1.1，等离开）→ 按 Home 后 2 秒内静默装成 3.1.2，界面无任何提示，安装来源记录为 Obi 自己。
- 后台：应用进程不在时强制运行后台任务，发布 3.1.3 → 6 秒内静默装好；更新后后台任务仍在。
- 设置「应用更新」两种状态、备份提示、「更多」底部、备份卡片均截图核对。
- 后端 465 项、前端 144 项、typecheck、构建、泄漏扫描通过。

## 可能带来的新问题
- 依赖 GitHub 可达：国内网络下 `api.github.com` / `objects.githubusercontent.com` 可能慢或不可达，更新会延后（状态里显示原因，自动重试）。
- 已启用的服务器补丁更新器要重新安装定时器才改为 15 分钟；我已在自己的服务器上重装。
- 自动更新覆盖所有版本：将来若有不兼容的数据迁移，需要在新版本启动时自己处理（和服务器版一样由同一套后端迁移）。

## 关联
D-019 · D-021 · D-022
