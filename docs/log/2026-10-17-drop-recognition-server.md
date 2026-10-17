# 2026-10-17 · 服务端：移除 AI 照片识别与宿主侧数字实体生成

- **作者**：Claude
- **范围**：`server/{release_catalog,routes,context,engine_plugins,album_engine_adapter}.py` `app.py` `storage.py` `tests/*`；删除 `server/recognition.py` `tests/test_recognition.py`

## 改了什么
`recognition.py` 缩为只做 MusicBrainz 检索的 `release_catalog.py`（`ReleaseCatalog`，`Services.vision` → `Services.releases`，`/api/vision/release` → `/api/release-details`）；删除视觉模型配置、`/api/recognize`、批量照片草稿（`/api/imports/*`、`/api/import-photo/`、storage 里的草稿方法）、`/api/twins/start|cancel|guided`；视觉端口 `VisionAdapter` 对宿主恒为「未配置」（测试可传入带 `public_config/agent_json` 的对象）。目录检索测试移入 `tests/test_release_catalog.py`，删除 AI 识别测试，HTTP 孪生测试改为由存储层创建任务。

## 出现的问题
AI 照片识别已弃用；数字实体的生成已交给 Album Engine 项目，宿主不应再保留生成入口和模型配置。

## 怎么解决的
保留目录检索、实体持久化与插件管理；旧数据目录里的 `vision-config.json`、`imports/` 不读取也不删除。

## 可能带来的新问题
本应用不再能创建新的数字实体；已保存记录里历史的 `recognition` 字段不再显示（数据仍在）。后端 388 项测试通过。

## 关联
D-005
