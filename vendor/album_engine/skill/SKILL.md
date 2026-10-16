---
name: album-digital-twin
description: 为已在专辑编辑中确认的 MusicBrainz CD 发行版获取同版 CAA/Discogs 图集，生成数字实体并校准包装、连续印刷、书脊与盘面。
---

# 专辑实物数字孪生

以具体发行版和可见结构为依据，复用包装模板，直接引用原图校准印刷面。精度来自图集、比例与部件结构；缺失面保留缺失。

## 选择执行环境

- Codex agent 可用浏览器、图像查看与 shell 工具：按下方流程调用本 skill 的脚本，在新工作目录生成资料与实体 JSON。脚本路径相对于本 skill 目录。
- 网站配置的视觉模型仅接受图片和 JSON，没有浏览器或 shell：读取 [references/runtime-agent.md](references/runtime-agent.md)，只返回 PLAN/BUILD 阶段 JSON。服务端负责联网、冻结原图、校验与发布。

两种环境共用版本确认与实体契约；脚本输出本身不会写入账本或发布模型。若接入碟渡，读取 [references/diedu-integration.md](references/diedu-integration.md)。

## 核对发行版与获取图集

先读取宿主已保存并经用户确认的 MusicBrainz release UUID、发行资料和素材来源。条形码识别、候选查询与选择在专辑录入/编辑完成；本技能从已确认的发行版开始。未提供已确认 UUID 时返回编辑页完成确认，已有 UUID 而条形码为空时保留空值。

素材脚本接收已确认版本，仅可用已知完整条形码交叉核对同一 UUID：

```sh
python3 scripts/fetch_release_art.py <已确认 release URL 或 MBID> --confirmed --output <新的临时目录>
# 只有宿主保存了完整条形码时才加 --barcode <已保存的条形码>
```

脚本冻结 MusicBrainz/CAA JSON 和未改像素的图；仅沿该 release 的 `url-rels` 中 Discogs release 关系补证，完整条码、目录号及 CD 介质一致后才纳入图集，标题相似或同一 release-group 不够。`manifest.json` 保存实际尺寸、来源与失败项；没有读取到角色不等于角色不存在。Discogs 图常只有约 600 px，先查看同版 CAA 大图或请求新扫描，不把同一小图放大称为高清。

直接打开原图逐面确认。CAA 的 `Booklet` 可能是册页，也可能误标外包装展开图；交叉核对同版结构说明、正背印刷、纸袋、折线与订钉，再分配角色。册页、外套及 OBI 分开；按实际字样识别 CD 1、CD 2，不按图集顺序猜。

## 跨发行版本的图集选取

严格先使用已确认发行版自己的 CAA 图，再使用以完整条形码、目录号、CD 介质同时验证过的同版 Discogs 图。如果不足，再检查 MusicBrainz 同一个 release-group 的其他具体 CD 发行版，只接受已知封装类型完全一致、CD 张数相等的版本，以正背、盘面、册页角色覆盖率及原图数量排序。这些只能作标注源发行版 UUID 的印刷参考，不能改变用户已经确认的发行版 UUID，不能拿 Jewel Case 的结构当纸封套，不能拿双 CD 当单 CD。

2017 年日本版 the Glow, pt. 2，EAN 4582237837001（EPCD-100）：CAA 本版无图，但其同版 Discogs release 11384187 有 22 张图，包含纸封套正背、CD、侧标、册页，应优先使用同版图。该版为 A 式单袋厚纸封套（非 Gatefold）；别把 2001 年 Jewel Case 版的 7 张 CAA 当成同封装。无对应模型部件时保留侧标、册页为来源证据，不将其伪装成内封板。

## 校准模型

从实物图确认 Jewel Case、Card Sleeve、Gatefold Sleeve、Digipak、Digibook 或 Rigid Box，另列 Mini LP 和 Slipcase 属性。记录折页数、袋口方向、托盘/纸袋、CD 分配及开合轴。

盒内册页的折页数与外包装板片数分别判断；`Booklet` 展开图不等于纸套包装。用户提供的《Illinois》样例有 roll-fold 册页，发行资料的外包装仍是 Jewel Case。

MusicBrainz 的 packaging 为空时继续查同版结构证据，仍不足才保留未知。《Islands》4988013047105 / PCCY-01424 的 MB 关系指向 [Discogs release 2485482](https://api.discogs.com/releases/2485482)，其说明为 gatefold vinyl replica sleeve，另有英文 12 页、日本文 8 页和 OBI。CAA 图 `10468808112` 为 3244×1592 的星云展开图候选；确认印刷与折线吻合外包装后才采用。带订钉的册页中页不能用于书脊；其它 `Booklet` 图也须按实际结构判断，既不全当包装，也不一概排除。参考图的折损只描述来源副本。

展开扫描直接绑定原文件；四角用 `region`，弯曲折线用 2–17 行 `warpRows` 连续映射。外书脊与内折脊分别绑定。需要可重复的书脊校准时读取 [references/spine-calibration.md](references/spine-calibration.md)，执行 `scripts/calibrate_spine.py`。它将已确认的原图像素边界归一化，并独立计算窄脊与同平面单块封板的宽度比；输出可合并到 BUILD 的 JSON，不裁图、不改照片或账本。

比例标为 `image-estimate`，透视、斜视缩短或阴影明显时换平展图或保留限制；不能从印刷亮度推算真实毫米或褶皱高度。只有明确给定的保守近似轮廓才输出 ±0.15 mm 内的 `reliefMm`。纸脊、轴心和接缝随校准一起调整，CD 保持真实大小；与最小袋腔间隙冲突时保留空间并报告限制。纸材微纹理独立于印刷，斜视与缩小时应平滑减弱。

盘面印刷与材质分开：保留真实字样、方向和图案；15 mm 中心孔、透明夹持圈、金属数据环与标签各为独立表面。扫描中的白色反射不能烘焙成透明圈上的白墨。完整盘面不足时列出缺口，原图清晰度决定小字上限。反面的刻码或专属图案只在有证据时加入。

取放动作沿对应袋口或托盘运动，盘体与透明中心圈一起移动；查看时可独立旋转，放回原盘位，闭合包装前收回 CD。使用已有灯箱与手势，不增加与任务无关的资料面板。

## 交付验证

检查正反面、侧脊、展开图、每张 CD 取出/旋转/放回及关闭时收回；覆盖动画中间态、反向接管与手机视口。截图等动画结束。区分图集参考、本副本照片、名义比例和实测；浏览器验收与实机感应、帧率分别报告。

网站确认后保存版本与图集快照并执行 PLAN/BUILD，校验通过才发布。重复点击与多窗口共用任务；关闭编辑不取消后台生成。核对、生成与状态仅在编辑内，展示只读封面或已发布实体与标题。验证时区分 Codex 脚本执行、真实视觉模型生成和参考实体演示；新增记录不会自动生成。

接口依据：[MusicBrainz release API](https://musicbrainz.org/doc/MusicBrainz_API)、[CAA API](https://musicbrainz.org/doc/Cover_Art_Archive/API)、[图片角色](https://musicbrainz.org/doc/Cover_Art/Types)、[Discogs API](https://www.discogs.com/developers/)。
