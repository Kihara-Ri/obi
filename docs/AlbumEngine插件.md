# Album Engine 插件与持久化

当前官方包：0.3.0；插件协议 1，实体 schemaVersion 2，rigVersion 1，modelSet `album-rig-1`。

## 安装与卸载

新实例默认未安装，在设置的「唱片实体引擎」安装。框架提供固定官方 ZIP 和 SHA-256 目录，支持离线安装；不接收任意 URL 或用户上传的可执行包。安装验证全包、文件清单和协议，经暂存目录验证后切换版本。安装/卸载接口采用现有登录与 CSRF 保护，revision 拒绝多窗口迟到操作。浏览器入口 URL 含版本，避免升级复用旧 ES module。

卸载真实移除用户数据目录中的 `plugins/album-engine/`，不会删除账本、实体文档、贴图或固定模型。存在 queued/running 任务时拒绝卸载。损坏包或未安装不阻止账本启动；发行版封面查询也是独立的 2D 功能。卸载后展示普通封面，重新安装后有效实体可再次切换 3D。

## 用户数据与程序边界

| 内容 | 权威保存位置 | 卸载行为 |
|---|---|---|
| 收藏、采购、销售、运输 | SQLite | 保留 |
| 包装、内容物、印刷面、毫米尺寸、材质、装配关系 | SQLite canonical 实体文档 | 保留 |
| 专辑专属镜头参数 | 文档 `presentation.initialCamera` | 保留 |
| 贴图与原始素材 | 用户数据 `digital-twins/<job>/`，DB 保存绑定/来源 | 保留 |
| 已发布实体使用的 GLB 与模型清单 | `engine-models/<sha256>`，DB 保存版本/文件/哈希 | 保留 |
| 查看器、编辑器、通用动画/运镜算法、生成执行器 | 已安装的官方插件 | 删除，重装恢复 |

模型清单按已发布任务固定，插件升级不替换其字节，相同模型按内容哈希去重。镜头参数支持 pitch/yaw（弧度）、zoom、framingX/Y（归一化）。已编写参数会经发布、校准、恢复和查看器完整传递；没有参数时使用引擎默认镜头。普通拖动是会话查看状态，不自动覆盖发布参数。动作算法属于程序；每张专辑不同的结构、挂载点与作者参数属于实体数据。

数据库 JSON 导出包含文档、镜头参数和模型哈希清单，**不包含二进制图片或 GLB**。完整迁移需同时保存数据库和 `covers/`、`photos/`、`digital-twins/`、`engine-models/`；每日 SQLite 快照和 Litestream 本身不保护这些文件。导入 JSON 不会恢复或自动启用可执行插件。固定样本 `preview_samples.py backup/restore` 已归档用户资源和离线素材包，插件可重装。

## 宿主接口

- `GET /api/plugins/album-engine`：安装/可用版本、revision、入口/样式/模型 URL、busy 和错误。
- `POST /api/plugins/album-engine/install` / `uninstall`：`{expectedRevision}`。
- `/api/plugins/album-engine/assets/<version>/...`：仅当前有效安装的公开浏览器/模型文件，沿用鉴权。
- `/api/twin-model-assets/<job>/<name>`：鉴权读取该发布任务固定的 GLB，校验内容哈希。
- 插件浏览器导出 `manifest`、能力/校准函数和 `mount(kind, element, props)`，返回独立资源清理函数。宿主只挂载容器与保存回调；卸载立即停止 GPU、动画、感应与监听器，随后卸载独立 React root。
- Python 运行库通过 Task/Vision/Catalog 窄适配器工作，不取得整个 Store 或数据库连接。所有权威写入仍通过 `storage.py`。

宿主保留 `vendor/album_data/` 和 `web/src/vendor/album-data/` 的纯数据协议，保证未安装时也能校验/恢复实体；其中不含生成执行器、渲染或运镜。旧 runtime 导出仅供历史测试/脚本兼容，不放进 Docker 或裸机包。

## 后续开发

所有 3D 修改只在独立引擎项目：Blender 源、GLB、材质、内容物、动作、镜头、素材规划、校准、生成与发布决策。修复后构建官方插件与纯数据导出，不直接改宿主生成文件。宿主只做插件管理/通用接口和业务变化。

在引擎工作树执行：

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run plugin:build
npm run studio:build
python3 -m unittest discover -s python/tests -v
python3 scripts/export-data-codec.py --python-output <宿主>/vendor/album_data --web-output <宿主>/web/src/vendor/album-data
npm pack --pack-destination <宿主>/web/vendor
```

将 `artifacts/album-engine-plugin-<version>.zip` 放入宿主 `plugins/album-engine/`，更新 catalog 的版本/文件名/SHA-256；更新开发用 npm 包与 lock。旧兼容脚本仍需要时才用 `scripts/package-runtime.py` 同步开发导出。应用构建不再复制 GLB 到 `static/`。

按根 AGENTS 执行宿主全套测试、前端检查/构建、固定样本浏览器、Docker 构建、裸机包和泄漏扫描。必须检查未安装、安装、真实查看、卸载后 CRUD/2D、重启、备份恢复、重装后文档/模型/贴图/镜头不变；还须覆盖坏包、迟到 revision、忙任务和跨窗口。测试通过不代表远端发布、手机感应或实机帧率验收。
