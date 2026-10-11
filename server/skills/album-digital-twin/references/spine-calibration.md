# 原图边界与窄脊校准

Codex 可执行本 skill 的 `scripts/calibrate_spine.py`；网站 JSON-only 视觉模型按相同实体协议直接返回归一化坐标，不调用此脚本。

先查看原图，确认 front/back/spine 为同一展平包装的正、背、外脊，定位两道真实折线。记录原图尺寸，使用原图左上为原点的像素坐标；正背跨度对应一块封板，不包括 OBI、册页或旁边投影。`samePlane:true` 表示这三个区域在同一个可比较的平展图像平面，不能用分别拍摄或缩放过的图比较像素。倾斜透视图仍有缩短误差，明显时选正视扫描或报告无法可靠估计。

输入示例（1000×500 的几何测试展开图，不是实物测量）：

```json
{
  "sourceId": "caa:123",
  "pixels": [1000, 500],
  "confirmed": true,
  "samePlane": true,
  "panelRole": "front",
  "surfaces": {
    "back": {"quad": [0,0,480,0,480,500,0,500]},
    "spine": {"rows": [[480,0,500,0],[478,250,499,250],[480,500,500,500]]},
    "front": {"quad": [500,0,980,0,980,500,500,500]}
  }
}
```

`quad` 为 TL/TR/BR/BL 八个像素数；弯曲边界使用 `rows`，每行 `[leftX,leftY,rightX,rightY]`，2–17 行从上到下排列。单面只提供其中一种。坐标有限且位于原图内，两侧高度严格递增，各段凸且边界无自交。相邻面的共享折线应使用同一组坐标，避免接缝文字不连续。额外的 `insideSpine/insideLeft/insideRight/insideCenter/insideExtra/outer` 也可在同一图上校准；默认仍用外 `spine` 与 `front` 估计，`panelRole` 可改 `back`。

```sh
python3 scripts/calibrate_spine.py <已确认边界.json> --output <新工作目录/calibration.json>
```

输出为实体 JSON 补丁：`surfaces[role]` 含真实 `sourceId`、四角 `region` 与归一化 `warpRows`；`calibration.spine` 含 `widthRatio/sourceId/basis:"image-estimate"`。把它与已核对的 `sameAlbum:true`、`packaging`、其它印刷面合并后，经应用已有发布接口校验。脚本拒绝覆盖已有输出及应用 `data/`，不读图像像素、不修改原图、不连数据库。

比例为脊的行宽中位数 / 所选单块封板的行宽中位数，按原图像素独立估计，范围 0.001–0.2；不同坐标轴的像素长度在归一化之前比较。阴影或黑色印刷不构成折线，也不能提供毫米、纸厚或褶皱高度。渲染采用名义封板比例，袋腔的 CD 最小空间可能限制收窄；尺寸仍只有用户实测才写入 `packaging.size`。

默认输出无起伏。只有已明确提供的保守近似时，在输入中加 `"reliefBasis":"approximate-profile"` 与 `"reliefMm":[0,0.06,0]`。3–17 个有限样本沿高度等距排列，每值限 ±0.15 mm；它是近似形状，并非从明暗生成的高度图，也不代表本副本磨损测量。纸材微纹理由渲染材质独立处理。
