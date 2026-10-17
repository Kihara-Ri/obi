# 2026-10-17 · Album Engine 0.3.0 制品与数据协议校验器

- **作者**：Codex 的未提交工作区改动；Claude 整理、验证并提交
- **范围**：`web/vendor/` `web/package.json` `web/package-lock.json` `vendor/album_data/` `vendor/album_engine/` `plugins/album-engine/` `web/src/vendor/` `web/scripts/album-engine-models.mjs`

## 改了什么
引擎 tarball 由 0.2.2 升到 0.3.0；新增官方可安装插件包 `plugins/album-engine/`（ZIP 与哈希目录）；新增纯数据协议校验器 `vendor/album_data/`（Python）与对应的前端契约 `web/src/vendor/album-data/`；`vendor/album_engine/` 更新 schema 与 runtime 清单，仅作历史脚本/测试兼容。

## 出现的问题
宿主原先直接携带完整引擎（查看器、生成器、模型），无法按需安装/卸载。

## 怎么解决的
引擎拆成可安装插件；宿主只保留数据协议校验与插件管理接口。

## 可能带来的新问题
仓库新增约 13 MB 的插件 ZIP 与 13 MB tarball；引擎升级后要同步更新插件目录里的哈希。

## 关联
见「服务端插件」「前端接入」日志
