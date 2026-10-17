# Album Engine 完整归属 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Continue through all tasks without requesting permission again. Steps use checkbox syntax.

**Goal:** 收藏默认 2D，只有引擎支持的实体显式开启 3D，模型及生成发布全部由引擎维护。

**Architecture:** 引擎提供可序列化 v2 装配文档、轻量能力检查、查看器和标准库 Python runtime。宿主维持业务状态、鉴权和 storage.py 事务，原任务 API 委托引擎；发行资料和旧任务 wire 结构可作为兼容 envelope，新增 canonical document 是引擎唯一的装配事实来源。

**Tech Stack:** React 19 / TypeScript / Three.js / Python 标准库 / SQLite。

**Spec:** ../specs/2026-10-15-album-engine-complete-ownership.md

## Global Constraints

- 不碰真实 data/；复用固定样本；保留当前两个仓库的未提交工作。
- 不提交或发布既有与本次混合改动；新建 codex 分支，工作保留供审阅。
- runtime 纯标准库；storage.py 唯一事务入口；import 零副作用。
- UI 和引擎资源/CSP/模型一同打包；稳定静态文件名；不依赖相邻源码仓库部署。

## Review Focus

- 旧实体附件关系无法确定时，不能伪称完整支持。
- 2D 模式不能申请感应、加载 Three/GLB 或残留 WebGL。
- 挂载父节点局部坐标、口袋朝向与 CD 中心在缩放后须一致。
- 附件/盘面校准修改与生成走同一个实体编译和发布校验。
- 迟到 worker、取消任务、备份恢复不能绕过 storage.py 令牌与新旧版本检查。

### Task 1: 引擎文档、能力与组件装配

**Files:** engine src/schema.ts, src/contracts/*, src/capabilities.ts, src/record.ts, src/core/album-accessories.ts, src/core/album-scene.ts, src/index.tsx, tests/*; 宿主 tools/seed_samples.py、tests/test_sample_library.py。

**Interfaces:** `AlbumEntityV2` 使用 assembly/root/components/assets；package 根提供 configuration 和印刷 surfaces；其余组件引用已注册语义 mount。`inspectAlbum(unknown, models)` 返回 supported + entity 或 reason。Python runtime 和 TS 读取同一个引擎 contracts JSON。

- [x] 先加固定样本导出的 v2 图、非法归属/尺寸、轻量导入与真实 GLB 装配回归，并验证最终回归。
- [x] 实现完整装配校验与 v1 只读兼容；明确槽位/尺寸；同一装配结果给附件与 CD 使用。
- [x] 修复 scene 在附件构建后才初始化 discs 导致真实盘片 metrics 无法使用的问题；检查实际 load 路径而非只测工具函数。
- [x] 全模型基础兼容与 Gatefold 125/135mm 完整附件组合通过引擎检查。
- [x] 引擎 npm typecheck/test/build/studio:build 全绿。

### Task 2: 生成、校准和发布 runtime 归属

**Files:** engine python/album_engine/*, schema/*, scripts/package-runtime.py；宿主 vendor/album_engine/*, server/album_engine_adapter.py, server/digital_twins.py, server/twin_*.py, twins.py, storage.py, Dockerfile, .dockerignore, tools/package_app.py, tests/*。

**Interfaces:** engine runtime 独立错误类型与 narrow ports；宿主适配 Store/vision/MB，异常映射回 domain。`compile_document(legacy_entity, key, title)` / `validate_document(document)` 与 TS contract 一致。旧 envelope 保留只读 wire 兼容，包含 canonical `document`，其与来源更新在同一 storage.py 事务中编译校验。发布决策和生成 worker 在 engine，host 服务只适配。

- [x] 已增加 runtime 脱离宿主 import、生成/发布委托、v2持久化和迟到结果回归，并验证最终回归。
- [x] 将 twin 来源、理解、装配、guided、worker/发布规则及 skill 移至引擎；原模块如需保留，只 re-export 或薄适配。
- [x] 迁移实体校验，不迁走宿主记录、金额、任务鉴权和事务；存储调用 engine publication 校验，不复制实体规则。
- [x] 发布 runtime、vendoring 同步工具、Docker/裸机输入齐全；保留现有来源、取消、去重及恢复行为。
- [x] 引擎 runtime 独立测试与宿主后端全套通过。

### Task 3: 平面默认展示与引擎接入

**Files:** host GalleryCase/GalleryMedia/GalleryFocus/GalleryPage/AlbumModel, core/album-entity.ts, styles/gallery*, web/tests/*；engine calibration UI export、preview entry、viewer unavailable lifecycle。

**Interfaces:** host `publishedAlbum(record, job)` 返回 canonical entity 和授权 resolveAsset；`AlbumModel` 消费 entity，不往返 Record.model*。Viewer `onUnavailable` 返回2D，strict renderer 不自动 CSS fallback。校准编辑器 engine owns props(entity, resolveAsset, onSave)，host仅注入保存回调。

- [x] 先写默认2D/能力切换/失败清理回归，并验证最终回归。
- [x] GalleryCase统一平面；灯箱逐张默认2D，能力通过后出现2D/3D；点击3D时才授权/动态导入。
- [x] 移除展示校准入口；在编辑区挂载引擎校准UI，宿主只做鉴权保存。
- [x] 2D预览使用引擎轻量投影，无封面保持缺失语义。
- [x] 升级版本化 tarball，前端typecheck/test/build全绿。

### Task 4: 完整交付验证与文档

**Files:** both README/AGENTS、宿主使用说明/部署说明/模块指南/复盘；固定测试数据和浏览器验收。

- [x] npm包和runtime产物可脱离源码运行；模型/协议/runtime版本匹配。
- [x] Python全套、前端typecheck/test/build、引擎typecheck/test/build/studio:build。
- [x] 固定样本临时实例 + Studio 空闲端口浏览器验证默认2D/切换/失败/交互/关闭/console；桌面与390×844。
- [x] Docker compose build；打包；泄漏检测；独立最终代码审阅，修复实际发现。
- [x] 文档与实际行为同步；报告验证与仍需实机/真实模型确认的具体范围。

## Execution ledger

- 2026-10-15：用户确认设计，开始实施。
- Ruling: 保留两个已有脏工作目录并切新 codex 分支，不创建缺失这些改动的干净 worktree；避免丢失已集成附件与样本工作。不存在提交/推送授权，本轮保留改动审阅，不混入原改动提交。
- Pre-flight: Task 1/2 共享 contracts JSON，Task 2 写 engine Python 与宿主后端，Task 1/3 写 TS/前端；不并行修改同一文件。Task 4在产物安装后进行。

- Task 1/3 progress: canonical v2 types generated from shared JSON schema, runtime and TS share model-set; default2D host no model fetch before click verified in browser; actual GLB assembly tests catch and fix CD initialization order, lyric booklet behind its leaf, sleeve front above pocket lip, inward opening direction. Final runtime schema interpreter and artifact checks underway.
- Task 2 review: two Important findings fixed with new regressions (legacy calibration must not assign mounts; narrow VisionPort only). Source of truth moved to engine; host module paths retained as compatibility delegates.
- Task 4 progress: baseline Python357 (1skip), engine93, web86 passed; final checks pending changed code. Docker daemon stopped; existing Colima VM being started without changing active Docker context. Browser runtime process missing; available Playwright tool used.


## 2026-10-16 最终结果

本轮实现与验证完成。引擎114、独立runtime6、前端105、后端390（1项缺少个人历史导入文件跳过）通过；Studio/宿主浏览器、Docker构建、npm独立解包导出、应用包、版本/哈希及泄漏检查通过。所有独立审阅报告的Important问题均已修复。

模型均由Blender制作；完整装配仅对模板尺寸开放，不同实测尺寸明确保留2D。没有发起真实视觉模型生成、实机感应/帧率测试或远端发布。详细结果与证据边界见 [交付记录](../reports/2026-10-16-album-engine-ownership.md)。
