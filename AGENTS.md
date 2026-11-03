# Obi · 项目标准（所有 agent 必读，违反红线的改动一律不接受）

个人 CD 收藏与交易账本：Python 标准库后端 + React/TS 前端 + SQLite，单用户，Mac 开发、服务器（Docker 或裸机）部署。
仓库是**可分享的框架**：不含任何个人数据（历史采购/运维记录在 `data/`，未跟踪），别人克隆后 `docker compose up -d --build` 即可开自己的实例。
动手前先读完本文件；与本文件冲突的旧做法以本文件为准。

## 开发复盘

后续开发同时查阅 [AI开发复盘.md](AI开发复盘.md) 中与任务相关的案例，先核对已有组件、所有使用入口与历史触发条件，避免再次要求用户提醒已定规则。复盘中的「待核查」是证据边界，不是已验证故障或新的业务决定；行为口径仍以本文件及用户最新明确要求为准。

## 红线

1. **服务端零第三方运行依赖**（纯标准库）。工具脚本可用标准库 + 已装库（如 PIL）。
2. **绝不触碰 `data/` 下已有数据**：代码只经 `storage.py` 的事务写库；任何脚本不得直接改 `data/*.sqlite3`。**仓库与 git 历史不得包含任何个人数据**（采购记录、成交截图、密码、域名、ssh 主机名等）。三道防线必须保持有效：
   - `.gitignore` 安全网（`*.sqlite3`/`.env`/`albums.json`/凭证目录等模式）；
   - 本地钩子 `tools/hooks/`（pre-commit 扫暂存区、pre-push 扫全树）——**克隆后必须执行 `tools/setup-hooks.sh` 启用**；
   - CI 权威闸门 `.github/workflows/ci.yml`（文件树 + 全历史扫描，红灯即修复，不得绕过）。
   共用检测脚本 `tools/check-data-leak.sh`；新增敏感模式要同时进它的 FILE_RE/CONTENT_RE。个人配置的真实值（域名/密钥/路径）只放 `data/`（未跟踪）或服务器上，仓库里一律用 `your.domain` 等占位符。
3. **金额语义**：服务端 Decimal、字符串传输；前端 `Number()` 仅用于显示。**成本缺失 = null，永不当 0**；利润只计成本已知的明细；分摊尾差保证总额不变。
4. **CSP 无内联**：不用内联 `<script>`/`<style>`；前端只用 ES module；外部资源仅限 CSP 白名单域。
5. **行为不变的重构必须零行为、零视觉变化**。业务口径、文案、交互有任何拿不准的，先问用户，不自作主张。

## 架构规则（加功能的唯一路径）

### 后端
- 新增 API = `server/routes.py` 表里加一行 + 一个处理函数。**禁止在 `server/http.py` 写具体接口**。
- 静态文件：`static/` 下任何真实文件自动可访问（`server/static_files.py`），无需登记；但启用登录后仅 `static_files.PUBLIC`（登录页及其渲染依赖、PWA 壳元数据）免登录，其余路径未登录一律服务端 302 到 `/login`。
  手工维护的静态文件：`login.html`、`login.js`、`offline.html`、`sw.js`、`manifest.webmanifest`、图标、`vendor/`。
- `app.py` 只做 CLI / 组装 / 启动。服务一律经 `server.context.Services` 注入，**禁止模块级单例**（import 零副作用）。
- 根目录业务模块（`domain/storage/covers/rates/security/backups/photo_uploads`）**不得移动或重命名**（`tools/` 依赖顶层 import 路径）；`storage.py` 保持单文件（跨表事务 + 审计内聚，不拆）。分层单向：`server/` 与 `app.py` 依赖根目录业务模块，根目录模块**不得**反向 import `server/`（曾因 `storage.py` 里 `from server import photo_uploads` 形成导入环，`import storage` 先行的入口全部报 `ImportError: cannot import name 'SCHEMA'`）。
- 版本：发布包带 `VERSION`（git describe 生成：正式版是 tag，日常部署是构建号），`/api/health` 与设置页显示。
- **本机模式（D-019）**：静态站点上由浏览器里的 Pyodide 运行同一套后端，入口 `server/local_entry.py`，只在 `dist-local/`（`npm --prefix web run build:local`，不进 `static/`、镜像与 git）里启用，靠 `index.html` 的 `obi-local` 标记识别。**业务代码与路由表不得为本机模式分叉**——浏览器与服务器的差别（无线程、无 socket、无 fcntl）只在 `local_entry.py` 抹平；后端新增线程 / 子进程 / 文件锁依赖时，必须同时保证本机模式不会走到（或在该文件里替换），并跑 `tests/test_local_entry.py`。服务器版 `static/sw.js` 不得加入本机转发。安卓外壳另有只监听 `127.0.0.1` 的原生模型中继（D-030）：页面经 `ObiAndroid.modelRelay()` 取得地址并写入 `OPENCODE_RELAY_BASE`，Python 侧只按这个前缀改写 OpenCode 地址；不得把它扩成任意主机代理。浏览器静态站点没有中继，售卖照片识别仍不可用。

### 前端（`web/`，React 19 + TS strict + Vite）
- 分层单向依赖：`core/` ← `components/` ← `pages/` 与 `forms/`；**禁止反向 import**（`web/tests/layering.test.mjs` 机检）。要打开表单或挂页面的卡片放 `pages/`。
- 全局状态只经 `src/state/AppContext.ts`；禁止新增模块级可变全局。
- 新页面 = `src/pages/` 加模块 + `App.tsx` 加一行 `lazyPage` 声明（每页一个 chunk，见 `core/lazy-page.ts`）并在分发里加一行；新表单 = `src/forms/` 加模块。
- 既有页面级样式放 `src/styles/<模块>.css` 并在 `main.tsx` 按序 import（**新建/重写的单元组件例外**：`components/ui/<Name>/<Name>.tsx + .css` 同目录，见 docs/DECISIONS.md D-003）（tokens → base → layout → components → 各页面模块）；`@media` 跟随所属模块；文件不超过一个职责。
- **改完必须** `npm --prefix web run typecheck && npm --prefix web run build`——服务端只认构建产物（`static/assets`、`static/index.html`），改源码不构建等于没改。产物不进 git（D-038），发布与 CI 都现构建。
- `static/assets` 文件名保持稳定（不哈希）：服务端对构建产物下发 `Cache-Control: no-cache` + ETag（未变即 304），测试断言固定路径。

## 用户已定案的界面与功能（不得回退）

逐条定案全文在 [docs/界面与功能定案.md](docs/界面与功能定案.md)（「功能组合」、「界面规则」、「数字实体（2026-10-17：生成已移出本应用）」、「条形码优先录入（2026-10-13 定案）」、「售卖草稿（2026-10-28 更新，D-031）」、「售卖识别多服务商（2026-10-19）」）。**改动这些领域前必须先读对应小节**；与之冲突的改动先问用户。贯穿全局的原则：

- 主界面只留控件和数字，解释收起来；少字、图标化。
- 空间结构不被破坏：抽屉只向下收回、不横推；悬浮条不挤压布局；顶栏不动、内容淡入。
- 同一种交互只有一份实现（滑块、下拉、左缘返回、文字输入），新建前查 [组件注册表](web/src/components/REGISTRY.md)。
- 动效连续、可逆、不脉冲，只表达空间关系。
- 状态不只靠颜色；颜色只走 token；主题三态默认跟随系统。
- 默认保守，高级能力显式开启；模块关闭只收入口，绝不删改数据。
- 少录入但不误录入：条码 / 编号精确匹配，多候选必须人选，不按标题猜。
- 手机是主场景，桌面是管理台；键盘、手势行为只有真机能证明。

## 验证门槛（全部通过才算完成）

```sh
python3 tools/run_tests.py                                                 # 后端全绿（按模块并行；-j 1 即串行）
npm --prefix web run typecheck && npm --prefix web run build               # 前端
OBI_DEV_HOME=/private/tmp/obi-acceptance python3 tools/preview_samples.py prepare --download
OBI_DEV_HOME=/private/tmp/obi-acceptance python3 tools/preview_samples.py --port <空闲端口>
```

- **8765 等本机常用端口可能被常驻服务占用**——验证一律用空闲端口（如 8791）+ 临时数据目录 + `--no-seed`；Docker 验证用独立端口与临时卷。
- **后续测试统一复用固定样本库**（`tools/seed_samples.py`）：现有 21 副本覆盖国内/海外/在途/售出中/已售/回收站、日元/人民币、多副本分组、侧标、新式包装资料、成本缺失等场景，金额日期渠道均为虚构、不含个人数据。涉及专辑场景的自动测试、浏览器验收与手动测试均从这里的样本定义和初始化入口取得数据。真实封面与 3D 验收统一使用 `tools/preview_samples.py`：首次 `prepare --download`，后续直接启动同一固定开发目录；仅显式 `--rebuild` 归档后重建。素材锁为 `tools/sample-bundle.json`，启动检查 21 张封面、三个发布文档的印刷面绑定、19 份模型图片与引擎契约；缺失必须失败，不能临时补图绕过。日常预览允许固定仓库外目录；自动验收用独立 `OBI_DEV_HOME`。`backup/restore` 完整归档包含图片和离线素材包，JSON 不能替代图片。离线业务单测仍允许无封面，`--with-models` 仅作隔离几何测试，保留合成光栅、物理装配及账本边界覆盖。普通展示禁止合成图或相似版本填补；公开图集须标为版次参考。缺少副本、包装、照片、条码、数字实体任务或贴图场景时，先扩充此样本库及其可复用素材/初始化方法，同步更新 `tests/test_sample_library.py` 的覆盖点和必要断言，再执行验证；不得另起一套从零造数据，也不得在一次性验证脚本中临时补造贴图或发布任务来绕过样本库。测试仍在独立临时数据目录运行，不修改真实 `data/`。样本清单与各覆盖点见 `tools/seed_samples.py` 模块注释。
- 涉及 UI 的改动必须浏览器实测：console 零报错 + 关键流程走通。
- 截图视觉验收要等动画结束（灯箱 0.15s / 抽屉 0.22s）再判断。

## 发布与运维标准

- **Docker 一键部署是主路径**：`docker compose up -d --build`。改了 `Dockerfile` / `docker-compose.yml` / `web/` / `static/` 中任何构建输入，必须实测 `docker compose build` 通过再提交；`.dockerignore` 与 Dockerfile 的 COPY 清单保持同步（新目录默认不进镜像）。
- **数据与框架解耦**：容器数据只写 `/data` 卷；compose 挂载 `./data`；任何代码不得把用户数据写到其他位置。
- **版本号：构建号随部署走，正式版攒批再打（D-024）**。
  - **日常部署**：提交后直接 `tools/deploy.sh`，**不打 tag、不改版本号**；VERSION 自动是 `git describe` 构建号（如 `v3.8.5-3-gabc1234`，带 `-dirty` 表示含未提交改动）。改动写进 `CHANGELOG.md` 的「## 未发布」；提交说明不再附版本号。
  - **正式版**：一个主题做完、真机确认后才打 tag（`v主.次.补丁`，CI 绿灯才允许）→ 把「未发布」改成 `## v… （日期）` → `python3 tools/package_app.py` → `gh release create <tag> dist/album-ledger.tar.gz --generate-notes --notes "…"`，附 sha256。只有正式版会弹「更新说明」，也只有正式版会推到安卓手机（安卓只认 GitHub 正式 Release）。
  - **哪一段升**：主 = 数据 / 备份格式不兼容；次 = 改了 `android/` 原生（D-023 强制）或明显的新功能；补丁 = 一批修复，不是改一处发一次。
  - 裸机发布 = `tools/deploy.sh`（release 布局 + 健康检查 + 自动回滚；首次 `--init`）。
- **服务器布局（裸机）**：`BASE/releases/<时间戳>/` + `current` 软链 + `data/` 与 `service.env` 在 releases 之外——**不得把数据放进 release 目录**。
- **数据安全三层**：每日快照（Backups）+ 发布前快照（deploy.sh）+ Litestream 异地复制（`deploy/litestream*.yml`）。动 schema 前必须确认快照存在。
- **文档即真相**：`README.md`、`使用说明.md`、`部署说明.md` 与实际行为必须同步，不同步视为未完成；文档不写具体个人的域名/路径/账号。

- 购买渠道模型图标：仅在新名称成功保存后异步调用 Pi CLI，无工具调用，不改用户文本；认证留在服务端 Pi 用户目录，失败可显式重试。参见 `docs/PI_SHOP_BRANDS.md`。
- Album Engine 0.3.0 为设置中可安装/卸载的独立插件。所有 3D 模型、内容物、材质、折叠、装配、交互、镜头、素材处理、生成与发布决策只在引擎项目修改；宿主只有插件生命周期、通用挂载、窄能力、资产鉴权与 `storage.py` 事务。官方 ZIP 在 `plugins/album-engine/`，运行安装目录在用户数据内 `plugins/album-engine/<version>/`；新实例默认未安装。卸载不删除用户实体、模型、贴图或镜头参数，忙任务拒绝卸载。元数据/清单在 SQLite，二进制在 `digital-twins/` / `engine-models/` 并纳入完整目录备份。`vendor/album_data/` 与 `web/src/vendor/album-data/` 为引擎生成的纯数据导出，禁止手改；旧的宿主内生成管线（~~`vendor/album_engine/`~~ 与 `server/twin_*` 兼容层）已删除（D-017），生成只在插件内。v1 不明归属保持 2D，不自动补齐或重跑。必须验收真实安装/卸载/重启/恢复/重装及无插件的账本与 2D；详见[插件契约](docs/AlbumEngine插件.md)。

当前 3D 模型集只对 Blender 模板尺寸保证完整装配；实测尺寸与模板不同则保留原资料并使用 2D，待引擎增加对应模型与整件净空验收后再开放 3D，不能整体缩放光盘来适配。
- **安卓补丁约定（D-023）**：同一 主.次 版本内的补丁只能改网页与 Python（`dist-local`），不得改 `android/` 的原生代码、权限与桥接；动了这些必须升次版本，否则已安装的应用换上新网页后与旧外壳不匹配。

## ai-kit 纪律（2026-10-17 接入，v0.2.0）

铁律见 [.ai-kit/rules.md](.ai-kit/rules.md)（R1–R12），本项目的取舍见 [docs/DECISIONS.md](docs/DECISIONS.md)。要点：
- 开工前读 `docs/log/` 最近 3 条、`DECISIONS.md`、`KNOWN-ISSUES.md`；收工前新增 `docs/log/日期-slug.md`。
- 新建 UI 前先查 [组件注册表](web/src/components/REGISTRY.md)，相似组件扩展 props，不新建近似品；新组件先登记。
- 颜色只经 token（D-002）；单文件不超过 200 行；组件文件顶部写用途注释。存量文件见 `.ai-kit/legacy.txt`，动到时顺手拆分并移出。
- 治理文档（规范、契约、运维说明）统一登记在 [docs/README.md](docs/README.md)；新增、改名或删除 `docs/*.md` 须同步更新该索引。`tools/check_docs.py` 在提交前校验链接、路径、决策与问题编号，以及索引完整性。
- 与本文件红线冲突时以本文件红线为准；提交前检查由 `tools/hooks/pre-commit` 依次执行数据泄漏扫描与 ai-kit 检查。
