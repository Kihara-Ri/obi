# 2026-10-24 · 完整备份改为含照片的 zip；数据页按去向分块；移除 albums.json 导入（D-026）

- **作者**：Claude
- **范围**：新增 `server/archive.py`、`web/src/core/backup-file.ts`、`pages/settings/ExportSection.tsx`、`tests/test_archive.py`、`web/tests/backup-file.test.mjs`；改 `server/routes.py`（`/api/backup` 出 zip、`UPLOAD` 表、删 import 接口）、`server/http.py`（整文件上传）、`server/local_entry.py`、`storage.py`、`app.py`、`BackupSection`、`ConfirmForm`、`core/api.ts`、`SettingsPage`、`deploy/nginx.conf.template` 与三份说明文档；删 `ImportSection`

## 出现的问题
「下载完整备份」与「导入 albums.json」都是选 .json，语义（整本替换 / 往里加）分不清；完整备份不含照片与自己上传的封面；albums.json 导入已无人使用。

## 怎么解决的
见 D-026：zip 备份（清单 + 账本 + 四个文件夹，逐文件 sha256），整文件上传恢复（先校验、暂存，账本成功后才替换文件夹，旧文件夹进 backups/pre-restore）；数据页分为备份与恢复 / 导出表格；恢复入口识别选错的文件；移除导入。

## 验证
后端全量测试通过（新增 zip 往返、坏包 / 越界路径 / 新版本拒绝且数据不动、HTTP 上传鉴权与类型、本机模式上传、包头布局契约）；前端测试含文件识别。浏览器在样本库预览里实测下载与恢复。

## 可能带来的新问题
线上 nginx 当前对请求体有上限（实测 60 MB 返回 413），需按部署说明补配置才能在网页恢复大备份；备份在内存里整包生成，数 GB 时需改流式。
