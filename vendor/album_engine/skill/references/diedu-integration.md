# 碟渡接入

先读宿主项目 `AGENTS.md` 和 `AI开发复盘.md`。引擎与宿主各自维护自己的职责：

- 引擎 `python/album_engine/` 拥有条码/来源校验、资料检索编排、视觉理解、人工选图、装配、worker 与发布校验；CatalogPort 注入宿主共享 MusicBrainz 客户端，复用同一节流，不另起请求节流器。
- 引擎 `src/contracts/model-set.json` 是模型名义毫米尺寸和语义挂载槽的共享定义。`scripts/package-runtime.py` 将同一 JSON、纯标准库 runtime 和本 skill 复制到宿主 `vendor/album_engine/`。部署不需要相邻引擎源码仓库。
- `compile_document(envelope,key,title)` 是 BUILD/发布时明确执行的 v2 装配编译，输出 assembly/components/assets；根包装 configuration 不允许照片序号。附件和 CD 通过注册 mount、parent、尺寸与 provenance 表达归属，不能通过任意 transform/scale 冒充。
- 包装尺寸 `basis: template` 为模板名义尺寸；仅用户填写的 packaging.size 使用 measured，图片比例估算只进入 calibration，不转换成实测毫米。四角 region、连续 warpRows、盘面校准均引用未改像素的任务原图。
- 宿主 `server/album_engine_adapter.py` 只提供窄任务、素材和资料端口并映射错误；`server/digital_twins.py` 只装配依赖。`storage.py` 保留唯一写事务、记录 revision、任务 claim/租约/取消、权限和审计。迟到结果须先通过 claim 与副本外观核查，再调用引擎 publication 校验与原图完整性校验并原子提交。
- 兼容 envelope 继续保留 packaging/surfaces/components 等原 wire 字段，同时新增 document v2。附件、盘面与书脊修改使用显式 update 上下文：已有 canonical document 在同一存储事务重新编译；没有 document 的历史实体仅保存兼容 envelope，不推断附件归属。只有显式 generation BUILD 可以分配新的模板槽。历史实体读取不自动编译、不重写；附件归属无法判定的旧实体继续保留 2D。
- 宿主 API `POST /api/twins/start` 请求核对，`POST /api/twins/confirm` 只确认本任务候选。核对、生成与状态在编辑内；新增记录及展示页不自动生成，关闭编辑不取消后台任务。
- 引擎 viewer 消费同一 canonical 文档；默认显示 2D，通过能力检查后由用户显式开启 3D。资产 URL/鉴权由宿主 resolver 提供。校准编辑器归引擎，宿主只提供保存回调。
- 测试仅使用宿主 tools/seed_samples.py 导出的固定合成样本及独立临时实例。脚本不直接操作 SQLite 或已有 data/；真实视觉模型质量、原图角色、浏览器行为与实机感应/帧率分别验收。
