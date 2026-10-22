# 安卓补丁无感知更新（v3.3.0，D-023）

- **作者**：Claude
- **范围**：`android/.../ContentPatch.java`（新）、`Updater.java`、`MainActivity.java`、`BuildConfigVersion.java`、`android/make-web-patch.sh`（新）、`.github/workflows/android.yml`、`docs/DECISIONS.md`、`CHANGELOG.md`、`部署说明.md`、`AGENTS.md`

## 改了什么
- 用户要求补丁自动、无感知更新。系统不允许应用静默重装自己，所以同 主.次 版本的补丁改为只下载网页内容包（`Obi-<tag>-web.zip` + sha256 + RSA 签名），用安装包自己的签名证书公钥验签后解到私有目录，外壳优先从那里提供页面。
- 生效：冷启动页面加载后，或后台 ≥30 秒再回来时：注销旧 Service Worker、清缓存、重载一次。

## 怎么验证的（Android 15 模拟器，debug 包 + 本机测试源）
- 3.3.0 安装包 + 3.3.1 内容包（用 debug 密钥签名）：打开即下载、验签、写入，`app.json` 的 VERSION 变为 v3.3.1，新 Service Worker 接管、缓存换新，应用内数据不动。
- 3.3.2 内容包签名被改一个字节：被拒绝（「补丁签名校验失败」），内容仍为 3.3.1。
- 未验证：正式 CI 产物（签名用 release 密钥）、真机、Android 10/11；用户在填写时回到应用的重载体验。

## 可能带来的新问题
- 违反「补丁不改原生」约定时，新网页可能调用旧外壳没有的桥接；见 AGENTS.md。
- 第一次要装 v3.3.0 安装包（旧版本没有补丁逻辑）。

## 关联
D-021 · D-022 · D-023
