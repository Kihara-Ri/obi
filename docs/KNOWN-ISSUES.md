# 已知问题

发现但没修的问题记在这里，不要擅自顺手修。只增不删（解决后标记"已解决"并写日志文件名）。

## I-001 · 切换国内 / 海外会重置搜索、排序与筛选（已解决：2026-10-17-ai-kit-and-ui-components.md，保留排序与上架筛选，搜索词仍清空）
- **发现于**：2026-10-17（日志 2026-10-17-ai-kit-and-ui-components.md）
- **影响**：中。`App.tsx` 在 `page` 变化时 `setQuery('') / setSort('new') / setShelfFilter('all')`，国内↔海外是同一张库存页的子标签，用户选好的排序会丢。
- **临时处理**：无。
- **为什么还没修**：属交互口径，需用户决定「同一库存页内切换地区是否保留排序与筛选」。

## I-002 · 新增专辑：「保存并入库」置灰却没有就地说明（已解决：同上，按钮旁加「先用条码匹配发行版，才能保存入库」，匹配后消失）
- **发现于**：2026-10-17
- **影响**：中。未匹配发行版时按钮灰显，提示要点保存后才以错误形式出现；用户不知道先要查条码。
- **临时处理**：无。
- **为什么还没修**：需要决定提示放在哪（按钮旁 / 条码区域），涉及 AGENTS.md 里「表单抽屉默认一屏放完」的约束。

## I-003 · 桌面侧栏顺序：海外库存 / 海外在途 排在国内库存之前
- **发现于**：2026-10-17
- **影响**：低。与手机底栏「库存 / 在途 / 售出中」的心智顺序不一致。
- **为什么还没修**：属用户已定的导航口径，未经确认不动。

## I-004 · 单文件过长、样式集中的存量
- **发现于**：2026-10-17
- **影响**：维护成本。`forms/RecordForm.tsx` 805 行、`components/ArtistProfile.tsx` 502 行、`App.tsx` 约 480 行等；`styles/` 下 35 个模块样式。均在 `.ai-kit/legacy.txt`。
- **临时处理**：动到哪个拆哪个，拆完从 legacy.txt 移除（D-001、D-003）。
- **进展**：2026-10-21 `App.tsx` 拆为外壳 + `state/useDrawerStack`、`hooks/usePageTransition`、`hooks/usePwa`、`state/useShelfView`、`components/AppNav`，降到 200 行并移出 legacy.txt（2026-10-21-frontend-split.md）。

## I-005 · 专用开关各写一份
- **发现于**：2026-10-17
- **影响**：低。`ui/Switch` 未被使用；喜欢开关（`album-like-switch`）、漫游开关（`gallery-roaming-switch`）是各自专用实现。
- **为什么还没修**：漫游开关的标记被 `gallery-roaming-switch.test.mjs` 逐字断言，需先同步改测试。

## I-006 · Docker 镜像缺 `kana.py`，容器启动即崩（已解决：2026-10-21-remove-legacy-pipeline.md，Dockerfile 改为 `COPY *.py ./`，与补丁包共用一份清单）
- **发现于**：2026-10-21（日志 2026-10-21-dead-code-sweep.md）
- **影响**：高（只影响 Docker 路径）。`covers.py` 在 6cb69f5（2026-10-21）开始 `from kana import romaji`，但 `Dockerfile` 运行时阶段的 `COPY app.py domain.py …` 清单里没有 `kana.py`；按 COPY 清单模拟镜像目录后，`import app` 抛 `ModuleNotFoundError: No module named 'kana'`。`tools/package_app.py`（裸机补丁包）已包含 `kana.py`，不受影响。
- **临时处理**：无。修法是在 Dockerfile 的 COPY 清单加上 `kana.py`，并实测 `docker compose build`。
- **为什么还没修**：本次任务是审查和清理，按 R9 只记录。

## I-007 · `/api/twin-source-preview/…` 永远 404（已解决：2026-10-21-remove-legacy-pipeline.md，移到 `GET_PREFIX` 并补路由测试）
- **发现于**：2026-10-21
- **影响**：中低。`server/routes.py` 把 `'/api/twin-source-preview/'` 放进了精确匹配表 `GET`，但调用方 `TwinAccessoriesEditor.tsx` 请求的是 `/api/twin-source-preview/<job>/<n>?source=…`，`resolve_get` 只对 `GET_PREFIX` 做前缀匹配，所以附件编辑器里发行版参考图都加载失败，只有用户自己的照片能显示。从 2026-10-14 加入起就如此。
- **临时处理**：无。修法是把该键移到 `GET_PREFIX`，并补一条路由测试。
- **为什么还没修**：同上。

## I-008 · storage.py 约 24 处 SQLite 连接未关闭（已解决：2026-10-21-sqlite-close.md，连同 server/ 下的直连共 42 处改为 `closing()`）
- **发现于**：2026-10-21
- **影响**：低。`with self.connect() as db:` 只负责提交或回滚，不会关闭连接（另外 22 处用了 `closing()`）。连接要等 GC 才释放，测试输出里有 `ResourceWarning: unclosed database`；长跑进程和备份时可能多占文件句柄。
- **临时处理**：无。
- **为什么还没修**：改动涉及唯一写入层的事务边界，需要单独做，并跑全量测试。

## I-009 · 裸机补丁自动更新拒收含 `vendor/`、`plugins/` 的补丁包（已解决：2026-10-21-remove-legacy-pipeline.md）
- **发现于**：2026-10-21
- **影响**：高（只影响裸机自动更新）。fe68191 起补丁包带 `vendor/album_data/` 与 `plugins/album-engine/`，但 `tools/update_release.py` 的 `PACKAGE_ROOTS` 白名单没有这两项，更新器校验时整包拒收。
- **临时处理**：白名单已补上。服务器上已部署的旧更新器仍按旧白名单拒收，需手动发布一次（`tools/deploy.sh`）把新更新器带上去。
- **进展**：2026-10-21 已用 `tools/deploy.sh` 发布（releases/20261021-232221），服务器上的更新器已是新白名单。

## I-010 · 发布快照直接复制 SQLite 文件，暂不能开启 WAL
- **发现于**：2026-10-21（日志 2026-10-21-sqlite-close.md）
- **影响**：低。WAL 可让读写互不阻塞，但 ai-kit ship 的发布前快照与回滚是直接 `cp data/albums.sqlite3`：WAL 模式下已提交的数据可能还在 `-wal` 文件里，快照会漏；回滚只覆盖主文件会与残留的 `-wal` 不匹配。
- **临时处理**：保持默认的 rollback journal；`busy_timeout` 已是 10 秒。
- **为什么还没修**：ship 由 ai-kit 管理（D-007），需先在 ai-kit 里改用 `sqlite3` 备份 API（或快照前 checkpoint）再开 WAL。

## I-011 · `server/` 下模块直接 `store.connect()` 读库
- **发现于**：2026-10-21
- **影响**：低（维护）。`routes.py`、`artists.py`、`shop_brands.py`、`starter_albums.py`、`listing_photos.py` 共 12 处绕过 `storage.py` 的方法直接拿连接读 `records` / `meta`（`shop_brands` 还直接写 `meta`），与「写入只走 storage.py」的约定有出入，读路径也没有统一口径。
- **临时处理**：这次只把连接改为用完即关（I-008）。
- **为什么还没修**：要给 storage 加对应的读方法并逐个替换，属单独重构。

## I-012 · 本机模式（D-019）的已知缺口
- **发现于**：2026-10-22（日志 2026-10-22-local-mode.md）
- **影响**：中（只影响静态站点上的本机模式，服务器部署不受影响）。
  - 设置页仍显示登录密码、售卖识别服务商、3D 引擎插件、商家图标等本机模式不支持的入口，点了会得到「不可用」类提示，没有统一的灰显说明。
  - 备份提醒与「数据可能被浏览器清理」的说明还没有做进界面；目前只靠文档告知，并在启动时申请持久存储。
  - 浏览器不允许设置 User-Agent，MusicBrainz 高频请求被限流时无法通过标识自证；未做针对性处理。
  - 站点必须部署在域名根路径（资源与 `/api/` 使用绝对路径），不能放在 `user.github.io/repo/` 这类子路径下。
  - iOS Safari 真机的持久化与清理行为只在 Chromium 里验证过，未上真机。
- **临时处理**：文档（部署说明 · 方案三）写明限制与「定期导出备份」。
- **为什么还没修**：属第二步（界面适配与引导），需要用户决定哪些入口隐藏、哪些保留并提示。

## I-013 · CI 首次下载固定样本时，Discogs 对 GitHub runner 偶尔返回不同内容
- **发现于**：2026-10-22（日志 2026-10-22-public-release.md）
- **影响**：低（只影响 CI 浏览器验收；缓存命中后不再下载）。
  - 新仓库没有 Actions 缓存，`preview_samples.py prepare --download` 拿到的 Discogs 图片字节与锁定哈希不符，报「远端素材已变化」；同一地址在本机下载与锁定完全一致。重跑一次后成功并写入缓存。
  - `tools/sample-bundle.json` 变化（缓存键变）或缓存过期后可能再次遇到。
- **临时处理**：失败时先看日志是否为该报错，确认本机下载哈希一致后重跑失败的任务。
- **为什么还没修**：要么给样本素材另找可公开分发的稳定来源，要么区分「被拦截」与「真的变了」，都需要单独评估版权与校验口径。
