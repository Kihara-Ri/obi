# 2026-10-17 · 前端：Album Engine 作为可选插件接入

- **作者**：Codex 的未提交工作区改动；Claude 整理、验证并提交
- **范围**：`web/src/{components,core,state,types.ts,styles,pages/SettingsPage.tsx,App.tsx}` `web/tests/*` `components/REGISTRY.md`

## 改了什么
新增 `useAlbumEngine`（读取插件状态、安装/卸载）、`album-engine-plugin` / `album-engine-mount`（动态加载插件并挂载视图）、`EngineMount`、`AlbumEngineSettings`（设置「高级」里的安装/卸载）；3D 查看、校准、编辑器改走插件挂载；`GalleryMedia` 不再内置引擎预览（未安装时只有 2D 封面）；设置页「高级」标签接入引擎区块。

## 出现的问题
前端原先直接 import 引擎，未安装时无法降级。

## 怎么解决的
引擎能力经插件运行时提供，失败回到 2D 并提示；2D、账本、备份不依赖插件。

## 可能带来的新问题
3D 相关浏览器验收（`npm run test:browser`、`engine-plugin-acceptance.mjs`）未在本次整理中重跑；单元测试 121 项通过。

## 关联
D-004
