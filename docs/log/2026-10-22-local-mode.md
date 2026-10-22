# 本机模式：没有服务器也能用（浏览器里跑同一套后端）

- **作者**：Claude
- **范围**：`server/local_entry.py`、`static/local/`、`web/src/core/backend.ts`、`web/src/main.tsx`、`web/scripts/build-local.mjs`、`web/package.json`、`tests/test_local_entry.py`、`.gitignore` / `.dockerignore`、文档

## 改了什么
静态站点上，Service Worker 把 `/api/*` 转给页面里的 Web Worker，Worker 用 Pyodide 跑现有路由表；数据存 IndexedDB。服务器部署不变。决策见 D-019。

## 出现的问题
- 内置浏览器窗格拿不到 Service Worker 脚本（连 `theme.js` 也注册失败），无法用它验证；改用 Playwright 的 Chromium。
- `engine_plugins.py` 顶层 `import fcntl`，Pyodide 里没有；先前的验证没走到这个模块。
- 一度把本机转发直接写进服务器版 `sw.js`：会让服务器模式的每个 `/api` 请求都多一道异步判断，且改变封面缓存路径。改为构建时用独立的 `sw-local.js` 替换 `sw.js`，服务器版 `sw.js` 保持原样。

## 怎么解决的
- 抹平差异放在 `local_entry.py`：就地执行的线程池、`urllib` 改走同步 XHR、`fcntl` 空实现、假 handler。业务代码与路由表不分叉。
- 判断是否本机模式只看 `index.html` 里的 `diedu-local` 标记（构建脚本写入 `dist-local/`），不做运行时探测：服务器断网时不会被误判成本机模式而显示空库。
- 被放弃的方案：TypeScript 重写后端（两份口径迟早分叉，金额语义风险）；托管多用户（改变数据在自己设备上的定位）。

## 可能带来的新问题
- 见下方「追加」：慢外网查询已拆到第二个引擎。
- 本机模式缺登录 / 售卖识别 / 3D 插件 / 商家图标 / 每日快照；设置页入口未适配（I-012）。
- 构建产物约 20 MB，首次打开较慢。
- 已验证：Python 463 测试通过（含新增 6 个）、前端 144 测试、typecheck、build:local；Playwright（Chromium 手机尺寸）实测启动、读取、新增、条码检索、艺人识别、封面搜索与下载、汇率、照片存取、刷新后数据仍在、断网重开、第二个窗口被拦并提示，console 零报错。
- 未验证：iOS Safari / Android Chrome 真机；浏览器清理站点数据后的恢复；Docker 构建（本次未改 Dockerfile 与构建输入以外的内容，`static/assets` 因 `main.tsx` 改动已重新构建）。

## 关联
D-019 · I-012

## 追加：外网查询独立引擎
- 问题：同步 XHR 占住引擎 Worker，封面搜索（约 10–20 秒）期间账本读写全部排队；Chromium 与 WebKit 都不支持 JSPI，无法让 Python 挂起，只能多开 Worker。
- 做法：同一份 Python 起第二个 Worker（`start-net`，`Engine(..., seed=False)`，数据在自己的 `/netdata`），只接不碰账本的接口：`/api/rate`、`release-details`、`catalog/*`、`covers/search|download`。其余（账本、艺人资料——要写账本）仍归 main。两者都收 `diedu-api` 频道的请求，各自按路径过滤；`sw-local.js` 不变。路由表与业务代码未分叉。
- net 起不来不影响账本，只是这几类查询无响应（SW 120 秒后 503）。多占一份 Pyodide 内存（几十 MB）。
- 验证：测试 6 通过；Playwright 中封面搜索 10.5 秒期间 `/api/state` 3–6ms，汇率 200，console 零报错。
- 未做：慢请求的取消按钮——同步 XHR 无法中断，取消只能丢弃结果，引擎不再被堵后价值不大。艺人资料接口仍可能占住 main（未实测）。
