# Album Engine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 独立维护完整唱片查看器、模型与 Studio，并以固定依赖原样接回碟渡。

**Architecture:** 新仓库发布单一 ESM 包，轻量 schema/packaging 入口与按需 viewer 分开。碟渡将已发布任务转换为纯实体，并提供同源素材与模型地址；持久化协议和任务不变。发布包随附 GLB 与外部 CSS，Docker 不依赖第二个源码仓库。

**Tech Stack:** React 19、TypeScript strict、现有 Three.js/Vite、Python 标准库工具、Blender 开发工具。

**Spec:** ../specs/2026-10-12-album-engine.md

## Global Constraints

- 不修改真实 data/；只用 tools/seed_samples.py 初始化独立临时样本。
- 服务端零第三方运行依赖；不改变 storage.py、接口、任务失效与发布规则。
- 重构零行为、零视觉变化，保留全部已有模型与缺图语义。
- 无新增内联 script/style；CSS 为外部文件；模型同源；构建文件名稳定。
- 保留原工作目录未提交文件；迁移基于当前磁盘代码。

## Review Focus

- 旧实体无版本：适配为 schemaVersion/rigVersion 1，不使金额或笔记刷新重置场景。
- 多副本及多任务资产：素材标识包含任务身份，缺面不偷偷复用封面。
- 相同实体重复读回：旋转、展开和抽盘状态不被重建。
- CSS 回退和关闭：两种实现使用相同贴图，解绑传感器并释放 GPU 资源。
- 独立安装/Docker：单独克隆碟渡后模型、CSS 与 lazy chunk 都进入部署包。

---

### Task 1: 独立实体与模型接口

**Files:** 新仓库 src/schema.ts、src/record.ts、src/core/album-model-assets.ts；碟渡 web/src/core/album-entity.ts；web/tests/album-entity.test.mjs。

**Interfaces:** `AlbumEntity {schemaVersion:1,key:string,title:string,packaging:PackagingSpec,surfaces,calibration?,placeholderHue?:0|1|2|3}`；`AssetResolver=(asset:string)=>string`；`ModelAssets={baseUrl:string,rigVersion:1}`；`toAlbumEntity(record:AlbumRecord):AlbumEntity`。

- [x] 建立固定样本驱动的适配测试：独立输入无金额/状态/照片序号，纹理来源、region/warpRows、未知结构、缺图与场景身份保留。
- [x] 运行测试确认新接口未实现时失败。
- [x] 实现 pure schema 与内部 ViewerInput 转换；保留宿主旧文字解析，模型选择改为稳定 thickness 字段。
- [x] 验证轻量入口没有 Three.js/React 运行依赖，模型协议不支持版本会被拒绝。

### Task 2: 查看器与模型包

**Files:** 新仓库 src/components/、src/core/album-*、src/styles/、models/、tools/、tests/、package.json、tsconfig.json、scripts/。

**Interfaces:** `AlbumViewer({entity,resolveAsset,models,permission,onRequestClose})`；`CSSAlbumViewer` 同一输入；`requestAlbumOrientationPermission()` 保留直接手势调用。

- [x] 迁移已有实现与算法测试，清除所有 AlbumRecord、AppContext、GalleryMedia 和业务路径依赖。
- [x] 模型/动作协议测试覆盖全部 21 GLB、单位、无图像、材质与 extras；保留既有几何验收。
- [x] 实体资源在内部解析一次；模型载入及 GLTF 相对地址由 ModelAssets 指定；中止/回收保持不变。
- [x] 构建 JS/类型/CSS/模型 tarball；npm pack 内容检查无个人资料与源码工作树依赖。

### Task 3: Studio 与共用样本

**Files:** tools/seed_samples.py（导出入口）、tests/test_sample_library.py；新仓库 fixtures/、studio/、vite.config.ts、README.md、AGENTS.md。

**Interfaces:** `python3 tools/seed_samples.py --export-engine-fixtures <dir>` 只导出已有 MODEL_SAMPLES、棋盘 PNG 和归一化像素，无数据库；Studio 从导出的 fixtures 读取。

- [x] 导出测试验证三种既有合成模型、逐面映射和相同 PNG，输出不含 API/任务/收藏字段。
- [x] Studio 调用正式公开查看器，提供样本切换、WebGL/CSS、关闭重开；不访问 /api/。
- [x] npm run typecheck/build/studio:build，浏览器走通包装与两张 CD 取放、回退及重开。

### Task 4: 碟渡接入与交付

**Files:** web/package*.json、web/vendor/、web/scripts/、web/src/components/GalleryFocus.tsx、useAlbumOrientation.ts、main.tsx、相关 tests；static/models/packaging/；Dockerfile；README.md、使用说明.md、部署说明.md、docs/模块扩展指南.md。

**Interfaces:** 模型构建复制到 static/models/packaging；GalleryFocus 继续只展示 succeeded 实体，标题与灯箱行为由宿主负责。

- [x] 安装 tarball 并锁定版本；删除引擎重复实现，将兼容入口收敛成轻量 re-export/宿主适配；迁移算法测试至引擎，碟渡保留接入测试。
- [x] 从固定样本库启动独立端口；浏览器验证全屏、开合/抽盘、切换、刷新保留与返回位置、console。
- [x] python3 -m unittest discover -s tests -v；npm --prefix web run typecheck/build/test；npm 引擎 typecheck/test/build/studio:build；docker compose build；泄漏检查及 git diff --check。
- [x] 独立复核两仓库接口、样本、包内容和部署链；修复有证据的缺口。
- [x] 文档记录运行、构建、更新与验收范围；两个仓库保存独立代码，无上线或公开发布。

## Execution record

- Native isolated worktree preserved the current uncommitted baseline before extraction. Existing changes remain in the original directory until verified integration.
- Editor calibration also consumed album-spine-fit; retained a small host adapter so both editor and renderer use the engine calculation.
- Independent review found Studio Escape handling missing; reproduced it in browser, added the Studio host handler, and verified closing/reopening.
- Legacy helpers remain host-owned; full renderer, fallback, motion, textures, geometry and model-authoring source now have one implementation in album-engine.
- Engine and host test counts are separated because algorithm tests moved to the new repository.

- Verified integration is applied to the original checkout; unrelated prior edits remain. Original checkout frontend 67 tests and backend 318 tests (one existing skip), typecheck/build and Docker build passed. Engine 67 tests passed.
- Closed/open/disc synthetic screenshots were pixel-identical to the preserved baseline. Standalone Blender generated all 21 valid models in a temporary output directory. Shipping GLB bytes remain unchanged.
- Studio hot module updates originally recreated an existing React root. A dispose handler now unmounts the old root; a fresh browser and controlled update verified zero errors.

## Final decoupling recheck

- A fresh standards/spec review found three remaining embedding defects: CSS input depended on host lightbox/drawer DOM, four theme defaults were absent, and published declarations failed strict NodeNext consumers.
- Host overlay detection now stays in the host hook and feeds an optional boolean into the CSS fallback. Default styles include all required tokens in the low-priority layer. Declaration relative imports receive `.js` extensions; external ESM and CommonJS consumer tests cover all public typed entries.
- These fixes ship as engine 0.1.1; the host vendors and locks the matching tarball. The independent browser regression imports the public package without Studio or host theme tokens and uses the same exported synthetic fixture.

- Final verification: clean staged engine install/typecheck/68 tests/Studio build and matching package contents passed. Host backend 318 tests (one existing skip), frontend 67 tests/typecheck/build, independent embedding and actual gallery browsers, clean Docker build and bare-metal package contents passed. Original 21 GLB bytes remain unchanged.
