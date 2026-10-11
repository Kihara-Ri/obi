---
name: album-digital-twin
description: 按 MusicBrainz 的具体 CD 发行版本获取 Cover Art Archive 实物图集，校准书脊、内页、盘面及可交互包装模型。用于专辑实物仿真或补齐模型贴图。
---

# 专辑实物数字孪生

以具体发行版和可见结构为依据，复用包装模板，直接引用原图校准印刷面。精度来自图集、比例与部件结构；缺失面保留缺失。

## 获取图集

网站中的「生成数字实体」使用 [references/runtime-agent.md](references/runtime-agent.md) 的两阶段协议。服务端保存任务、调用配置的模型和限定的资料工具，通过校验后才发布。页面上的重复点击只确认同一任务；关闭页面不会取消后台生成。

用户给 release 链接时，先查它的艺人、标题、媒介、包装、编号和条码。链接可能是另一个专辑的示例；确认用途后再绑定当前副本。只有标题时先找候选，保留版本歧义。

使用标准库脚本下载 API 元数据及所有原图到新的工作目录；下面的脚本路径相对于本 skill 目录：

```sh
python3 scripts/fetch_release_art.py <release URL 或 MBID> --output <新的临时目录>
```

完成标准：查看 `manifest.json` 的失败项、实际图片尺寸和缺失角色。成功获取 JSON 不代表图集完整。直接打开原图，逐面确认；`Booklet` 可能是多折页展开图，`Back, Spine` 常共用一张，`Medium` 是盘面照片，编号不能只按图集排列猜测。按字样或已标注序号识别 CD 1、CD 2。

## 校准模型

从实物图确认 Jewel Case、Card Sleeve、Gatefold Sleeve、Digipak、Digibook 或 Rigid Box，另列 Mini LP 和 Slipcase 属性。记录折页数、袋口方向、托盘/纸袋、CD 分配及开合轴。

盒内册页的折页数与外包装板片数分别判断；`Booklet` 展开图不等于纸套包装。用户提供的《Illinois》样例有 roll-fold 册页，发行资料的外包装仍是 Jewel Case。

展开扫描分成各印刷面四角，沿用完整原文件，用 UV/透视投影绑定。外侧书脊与内侧折脊分开。参照扫描中两道压痕之间的宽度，按同平面比例拟合书脊；透视实拍需先校正。纸层、袋腔及 CD 间隙同步调整，不能只压缩一张书脊贴图。图像估计标为参考，尺量才是实测。

盘面印刷与材质分开：保留真实字样、方向和图案；15 mm 中心孔、透明夹持圈、金属数据环与标签各为独立表面。扫描中的白色反射不能烘焙成透明圈上的白墨。完整盘面不足时列出缺口，原图清晰度决定小字上限。反面的刻码或专属图案只在有证据时加入。

取放动作沿对应袋口或托盘运动，盘体与透明中心圈一起移动；查看时可独立旋转，放回原盘位，闭合包装前收回 CD。使用已有灯箱与手势，不增加与任务无关的资料面板。

## 交付验证

检查正反面、侧脊、展开图、每张 CD 取出/旋转/放回及关闭时收回；覆盖动画中间态、反向接管与手机视口。截图等动画结束。区分图集参考、本副本照片、名义比例和实测；浏览器验收与实机感应、帧率分别报告。

若接入碟渡，读取 [references/diedu-integration.md](references/diedu-integration.md)。技能执行不等于网站已自动接入；只有实际接通新增专辑流程并验证后，才说明应用自动生成。

接口依据：[MusicBrainz release API](https://musicbrainz.org/doc/MusicBrainz_API)、[CAA API](https://musicbrainz.org/doc/Cover_Art_Archive/API)、[图片角色](https://musicbrainz.org/doc/Cover_Art/Types)。
