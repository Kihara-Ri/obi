# 专辑收藏卡：物理金属反射（PBR）

项目的 2D 专辑翻转卡片背面已经由多层 CSS 渐变/可见的重复横纹改为 Three.js 物理金属渲染。文字仍使用 DOM，因此保持清晰，不从专辑封面或副本信息推导金属质感。

## 实现

- `web/src/components/MetalBackCanvas.tsx`：仅在首次翻到卡背时加载 WebGL。 `MeshPhysicalMaterial` 的 `metalness=1`、`roughness=0.26`、`anisotropy=0.06`、`anisotropyRotation=Math.PI/2` 提供偏缎面的有方向性金属反射；`ACESFilmicToneMapping` 处理宽动态范围。
- `static/metal/studio_small_05_1k.hdr`：带有真实柔光板的工作室 HDR 环境。使用 `RGBELoader` 读取，在 GPU 采样前将灯箱的方形高亮转换为无方形边界、沿纬度连续变化的低频辐亮度底光，仍交给 PBR 材质计算金属反射。局部 PBR 聚光源负责鼠标位置的主要亮点。
- `web/src/components/AlbumFlipCard.tsx`：仍由 CSS 的正反面旋转负责翻卡；卡背 WebGL 只绘制金属表面。卡背文字、收藏日期和键盘交互保留 DOM。
- 环境反射强度和摆动幅度现在更克制；局部 PBR 聚光灯使用约 96% 半影，减少斜射入射造成的椭圆拉伸，并将各向异性由 0.32 降为 0.06。光标附近另有一个最大半径约 160px 的圆形低不透明度径向柔光，用于平滑明暗过渡，并非用 CSS 假造金属材质。
- 聚光位置、亮度和倾角均平滑缓动，鼠标离开或卡片翻回正面后会自动衰减；卡片销毁时聚光灯、纹理和其他 GPU 资源一并释放。
- 背面不存在明显可数的规则横条；旧 `repeating-linear-gradient`、彩虹箔和光泽叠加已移除。
- 不喜欢：银色缎面；喜欢：金色缎面。喜好仍属于 Album 实体；编辑入口维持红色开关，展示卡片不提供额外的喜好按钮。

- 正反面共享同一组鼠标位置与柔光强度：正面封面使用更弱的径向高光，背面则由 Three.js PBR 聚光灯和柔光叠加，鼠标离开统一渐隐。已移除封面原来的固定左上方反射和对角渐变；首次翻到背面时，WebGL 自动继承最后一次鼠标位置，避免亮斑突然跳变。

## 生命周期与性能

- 不显示卡片时不加载 Three.js 的材质渲染依赖；首次翻转时加载单份本地 HDR（约 1.6 MB）。不运行持续 60fps 空闲循环：只在鼠标倾斜动画尚未稳定时渲染，容器缩放改变时按需更新。
- 金属板使用透视相机，使每个像素的视线方向略有差异，能观察到不同方向的 HDR 环境；正交相机在平面上会产生近乎统一的反射。卡片正反面切换时保留 WebGL 底板，避免翻回途中出现银金材质短暂消失；退出放大视图时释放几何体、材质、环境纹理、PMREM、渲染器和 GPU 上下文。
- Pixel Ratio 上限 1.25，兼顾清晰度和功耗；遵循系统「减少动态效果」设置。
- WebGL 不可用或 HDR 不可用时保留无条纹的 CSS 渐变底板；HDR 不可用时可用内建 `RoomEnvironment` 的工作室环境离线回退。
- 对于依靠 SwiftShader 软件 GPU 的自动化浏览器，PBR 首次编译可能很慢；普通硬件加速 GPU 应按实际设备测量性能，不应把软件模拟渲染耗时当成硬件性能。

## HDR 来源与许可

资源：Poly Haven [Studio Small 05](https://polyhaven.com/a/studio_small_05)，作者 Greg Zaal。原始资源按 [CC0 1.0](https://polyhaven.com/license) 提供，可离线分发，不要求署名（本文保留来源说明）。

下载原始文件：
`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_05_1k.hdr`

SHA-256：`358d532ee8233f17499830eb512591c1e308ce16ed181e0efc938cb7f0f0e11f`。

## 验证

- `npm --prefix web run typecheck`
- `npm --prefix web test`
- `npm --prefix web run build`
- 开发服务器展示专辑，翻转银色和金色卡背，从不同位置移动鼠标，检查真实 HDR 反射随倾角更新；验证关闭后上下文释放、无 WebGL 时 CSS 回退。

### 摄影棚补光标定

Poly Haven Studio Small 05 原图为暗棚布光，镜面正对无灯区域时会像黑镜。为了让银色/金色铭牌保留可读的本色，加载后对线性 HDR 辐亮度进行低强度冷中性补光钳制（最低约 0.27/0.285/0.31），相当于在暗棚增加宽大的反光补光板；首次实现采用动态范围压缩，但用户发现左侧仍有矩形灯箱投影。这种实体光源形状仅压缩亮度无法消除，因此现改为计算原始 HDR 的平均环境能量，并按纬度重建连续中性的低频环境光。摄影棚灯箱不再以矩形投影出现在金属背面；局部聚光灯继续提供真实金属镜面亮斑。材质并不叠加 CSS 反光条纹。
