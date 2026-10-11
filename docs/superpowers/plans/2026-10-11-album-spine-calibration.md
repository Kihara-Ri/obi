# 专辑书脊与纸材校准 Implementation Plan

> **For agentic workers:** Use subagent-driven development for the independent source contract, renderer, and executable skill tasks; validate the integrated result in the real lightbox.

**Goal:** 从已确认发行版的实物图生成连续的正背/书脊印刷，独立校准窄脊宽度与有限曲面起伏，并把该流程收敛到可直接执行的 `$album-digital-twin`。

**Architecture:** 保留原图、共享无贴图 Blender GLB 和现有任务状态机。在数字实体中增加可选校准数据，展示派生记录读取它，原副本资料不变。MusicBrainz 精确版次关系可引入经条码/目录号核对的 Discogs 图集和结构说明；旧实体无新字段仍沿用旧模型。

**Tech Stack:** Python 标准库服务端；Blender 开发期生成 GLB；React/TypeScript/Three.js；本地技能脚本只生成新的工作目录。

**Spec:** 用户已批准本轮对话中“原图连续校准、按两道折线拟合窄脊、网格压痕与纸纹分开、同版高清图优先、参考磨损不代表本副本”的方案。

## Global Constraints

- 服务端零第三方运行依赖；生成和脚本不改 `data/` 下已有数据。
- 数字实体生成与状态仅在编辑；展示只保留模型/2D 封面与标题。
- 原图不改写；册页、外包装与 OBI 分别核对；图像比例不是实测毫米。
- 保留原任务的确认、幂等、租约、失效与原子发布契约。
- 不凭照片印刷明暗生成高度，不把参考副本磨损伪装成本副本实测。

## Data Contract

- `surfaces[role].warpRows`：可选 2–17 行，每行 `[leftX,leftY,rightX,rightY]` 原图归一化坐标，从上到下排列。连续有效的四边形带映射，弯曲折线不只用四角。无字段时沿用 `region`。
- `calibration.spine`：可选 `{widthRatio, sourceId, basis:"image-estimate", reliefMm?}`。`widthRatio` 是展平外折脊宽与单块封板宽之比；`reliefMm` 是可选 3–17 个沿高度排列的保守形状近似，限 ±0.15 mm，不代表测量。服务端清洗后保存真实资产来源，备份往返保留。
- 展示派生记录增加 `modelCalibration` 与按角色的 `modelWarpRows`；不得写回原 `packaging`。
- 校准只应用有连续折脊的纸包装。折脊与端点轴心同步，不能通过整组 depth 缩放光盘。与容纳光盘的最小间隙冲突时保留空间并明确校准限制。

## Review Focus

- 褶皱的行映射自交或越界须拒绝；无校准的旧实体行为不变。
- 参考来源版次不一致、外链不可用或没有书脊时保留缺失，不伪造资料。
- 任意开合中间态、反向接管时两侧接缝连续；CD 不穿纸袋。
- 纸纹在缩小/斜视时平滑减弱，避免再次产生摩尔纹。
- 原实体校准和来源经备份/恢复往返保留，脏输入不能发布旧任务。

## Tasks

### 1. 来源和校准协议

- [x] 在 `twins.py` / `tests/test_digital_twins.py` 先验证 warpRows、校准来源与范围、旧实体及恢复往返，再实现清洗。
- [x] 在 `server/digital_twins.py` 读取同一 MB release 的 Discogs URL 关系；按完整条码和目录号复核，冻结资料/图集，允许 agent 选择已获取的图，保持网络失败证据边界。
- [x] 运行后端相关测试，报告结果。

### 2. 曲面、UV 和纸材

- [x] `web/src/types.ts` / `core/digital-twins.ts` 传递新字段，新增有行为意义的渲染/几何测试。
- [x] `album-photo-material.ts` / `album-scene.ts` 对连续行分段投影；每面纹理先裁 ROI，保持原图不变。
- [x] `design/album-packaging/build_library.py` 增加纸脊纵向拓扑；独立校准脊宽及所有开合形状键，保留端点接缝和 CD 间隙。
- [x] 增加过滤后的微弱纸纹材质，不用印刷亮度驱动凹凸。
- [x] 重新生成受影响 GLB，运行几何测试、前端测试、typecheck/build。

### 3. 可执行技能

- [x] 更新已有 `server/skills/album-digital-twin/SKILL.md` 与 runtime-agent 协议；保留统一调用入口。
- [x] 添加 `scripts/calibrate_spine.py`，输入原图尺寸和人工/agent 确认的正背/脊区域，输出可校验的比例与 surface 校准 JSON；不改像素或账本。
- [x] `fetch_release_art.py` 支持条码候选模式和同版 Discogs 补证；唯一候选仍须确认。运行真实 Islands 元数据与可重复校准用例。
- [x] 更新已有技能 UI 元数据和相关产品文档，运行技能验证器。

### 4. 集成验收

- [x] 独立审阅具体差异，修复有证据的问题。
- [x] 后端全套测试、前端测试、typecheck/build、数据泄漏检查。
- [x] 使用固定样本库与隔离临时数据，在真实网页核对 Islands 的正背脊、开合中间态及 CD 取放；console 零报错。区分确定性参考演示与真实视觉模型生成。
- [x] Docker 构建验收；把完成代码同步回主工作区并保留可检查的预览。

## 验收记录

后端 315 项检查完成（1 项原有跳过），前端 112 项通过，typecheck/build 与数据泄漏扫描通过。最终源码已通过隔离 Linux arm64 Docker Compose 构建和容器健康检查。真实网页已检查正背、窄脊、展开、盘面取放和袋口暗示，以及 390×844 视口；console 无报错。Islands 是 Codex 按同版原图执行技能生成的参考实体，未声称网站视觉模型或手机实机传感器已完成验收。
