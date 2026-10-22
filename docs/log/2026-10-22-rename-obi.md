# 应用改名：碟渡 → Obi

- 用户对「碟渡」的读音和中日英混用的风格不满意，选定只用英文名 Obi（日版 CD 腰封「帯」），不配中文名。
- 改动：manifest `name` / `short_name`、`index.html` / `login.html` / `offline.html` 标题与大字、侧栏品牌、安装入口、设置引导、错误提示、服务端启动日志与「请重启」提示、README / 使用说明 / 部署说明 / AGENTS / 复盘 / 扩展指南 / 部署配置注释；`启动碟渡.command` 改名为 `启动 Obi.command`。中文与 Obi 相邻处加半角空格，全角标点前不加。
- 未改：仓库名与 clone 地址 `music-watari`、`diedu-*` 本地存储键与 `DIEDU_DEV_HOME` 等内部标识（改了会丢偏好）、图标（无文字）、CHANGELOG 与 docs/log 的历史条目、侧栏与登录页副标题「藏 · 渡 · 售」。
- 注意：已有字段 `obi` 是副本的侧标，界面显示为「侧标」，与应用名不冲突；代码注释里的 "Obi" 指侧标。
- 验证：后端 463 测试通过、typecheck / build 通过；浏览器 8793 临时数据目录实测标题、侧栏、引导页、manifest、离线页均为 Obi，console 只有内置浏览器 service worker 注册失败（已被代码忽略，与本次无关）。
- 未验证：已安装到主屏的 PWA 改名后是否刷新名称（iOS 通常需重新添加到主屏）。

## 追加：副标题、仓库名、首次引导

- 侧栏品牌与登录页去掉「藏 · 渡 · 售」副标题（连带删除 `.brand small`、`.login-tag` 样式）；登录页 h1 字距 .42em 是为两个汉字设计的，改为 .02em。
- GitHub 仓库 `music-watari` → `obi`，本地 origin、README / 部署说明 clone 地址同步；服务器 `/opt/diedu/update.env` 的 `UPDATE_REPOSITORY` 同步改为 `Kihara-Ri/obi`。自动补丁更新改名前就每天 404（仓库为私有，匿名 API 不可见），与本次无关，未处理。
- 首次引导：`needsSetup` 原条件是「未配置模块且无任何记录」，但非 `--no-seed` 启动会先写两张示例专辑，于是新实例永远跳过引导。`seed_starter` 写示例时同时记 meta `setup-pending`，`storage.state` 在未配置模块时把它视同空库；已有资料的旧实例不会有该键，行为不变。新增两条测试。
- 验证：后端 465 测试、前端 test / typecheck / build 通过；浏览器全新数据目录（带示例）首次打开即为引导页，「开始使用」后进入我的收藏、两张示例在；登录页标题正常。

## 追加：应用内不再改密

- 用户确认：登录密码只由服务端管理，应用里不需要改密。删除 `pages/settings/PasswordChange.tsx/.css`、账户页「登录密码」行（连带 `.account-row-action`）、`/api/password` 路由与 `Auth.change_password`；`--set-password` 本身会清空全部会话。原改密测试改为断言接口 404。部署说明、使用说明同步。
- 验证：后端 465 测试、前端 144 测试 / typecheck / build 通过；浏览器启用登录的本地实例，设置 · 账户只剩退出登录。

## 追加：撤回「应用内不再改密」

- 用户改为：启用登录的服务端实例可以在面板里改密。从 HEAD 恢复 `PasswordChange.tsx/.css`、`AccountSettings.tsx/.css`、`security.py`、`tests/test_web_app.py`，`server/routes.py` 手动加回 `api_password` 与 `/api/password`；部署说明、使用说明、CHANGELOG 还原。行为与改名前一致：改密行只在 `service.login` 为真时出现，本机模式显示「未启用登录」。
