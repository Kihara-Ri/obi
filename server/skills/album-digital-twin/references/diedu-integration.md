# 碟渡接入

先读项目 `AGENTS.md` 和 `AI开发复盘.md`，检查当前入口；下列路径均相对项目根目录。

- 包装解析与模板选择：`web/src/core/album-packaging.ts`、`album-model-assets.ts`。每副本的 `version`/`packaging` 决定模型；艺人或标题不是包装结构。
- 四角贴图：`packaging.photos` 指向副本照片索引，`packaging.photoRegions` 按照片左上原点保存 TL/TR/BR/BL 的八个归一化坐标。原图不裁成替代文件。`spine` 是外脊；`insideSpine` 是内折脊。
- 已发布实体可另存 `surfaces[role].warpRows` 与 `calibration.spine`，独立于人工包装记录；`core/digital-twins.ts` 仅为灯箱派生 `modelWarpRows/modelCalibration`。原图归一化行映射、图像估计比例与来源经 `storage.py` 清洗并随备份恢复，无新字段的旧实体沿用原投影与模板。详细坐标输入见 [spine-calibration.md](spine-calibration.md)。
- Blender：`design/album-packaging/build_library.py` 生成无贴图共享 GLB；照片只绑定副本，不嵌入共享模型。`nominal_mm` 是名义尺寸，`packaging.size` 仅存用户确认的实测。
- 渲染与交互：`album-scene.ts`、`album-disc.ts`、`components/AlbumModel.tsx`。图库代理维持轻量；聚焦灯箱懒加载真实模型。
- 保存：通过 `storage.py` 的事务和 revision，或者应用 API。测试用独立临时实例，保留其他记录和原照片身份；脚本不直接操作 SQLite 或已有 `data/`。
- 触发：编辑内 `POST /api/twins/start` 接收手动条形码或读取已保存实物照片，返回待确认的发行资料；`POST /api/twins/confirm` 只接受这次任务返回的候选并在同一任务内排队生成。展示页不提供生成入口。
- 验收：项目规定的类型检查、构建、测试和浏览器流程；文档同步，构建产物必更新。手机传感器与帧率另需实机证据。

自动化边界：网站视觉 agent 为 JSON-only，资料与原图获取由服务端完成；Codex 可另执行 skill 脚本。按条码核对、确认后生成已接入编辑流程，新增记录不会自动生成；实际模型生成质量、原图角色与浏览器/实机仍分别验收。CAA/Discogs 图集不保证每个版次都有全部内页、书脊或高清盘面。
