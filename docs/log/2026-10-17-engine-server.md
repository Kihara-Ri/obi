# 2026-10-17 · 服务端：Album Engine 插件生命周期与持久化

- **作者**：Codex 的未提交工作区改动；Claude 整理、验证并提交
- **范围**：`server/{engine_plugins,catalog_art,routes,context,digital_twins,album_engine_adapter}.py` `storage.py` `twins.py` `domain.py` `app.py` `tools/*` `tests/*.py` `Dockerfile` `.dockerignore`

## 改了什么
新增 `server/engine_plugins.py`：校验并安装/卸载官方插件（固定 ZIP + SHA-256 目录，不接收任意 URL/上传；有排队/运行中任务时拒绝卸载；损坏包与未安装不影响账本与 2D）；`routes.py` 增加 `GET /api/plugins/album-engine`、`install`/`uninstall`、插件静态资产（沿用鉴权）；`storage.py` 以事务保存实体文档、镜头参数与模型哈希清单（模型按内容哈希去重、按已发布任务固定）；`catalog_art.py` 提供封面补证；其余为适配、样本工具与 Docker 打包路径的相应改动，新增 `tests/test_engine_plugins.py`。

## 出现的问题
宿主原先直接携带完整引擎，无法卸载；实体数据与可执行文件耦合。

## 怎么解决的
可执行部分（查看器、编辑器、生成器）放进插件；数据（文档、贴图、模型清单）留在用户数据目录并随备份往返。

## 可能带来的新问题
数据库 JSON 导出不含二进制图片与 GLB，完整迁移要同时备份数据目录；本日志未逐文件复核服务端实现，依据是完整后端测试 400 项通过。

## 关联
D-004
