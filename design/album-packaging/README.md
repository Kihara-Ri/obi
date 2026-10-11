# Blender 包装模型

正式展示灯箱现在使用 Blender 导出的 GLB；九种浏览布局继续使用轻量 CSS 封面代理。生成工具不读写账本或个人照片，部署也无需安装 Blender。

`build_library.py` 生成 20 个无贴图共享模板：标准 Jewel Case、普通双碟/四碟翻转托盘、独立 Slimline 与双室 Fatbox、Card Sleeve、Mini LP Sleeve、Gatefold / Digipak 的 2/3/4 板片版本、三个 Gatefold 内开口纸袋版本、Digibook、套盖式 Rigid Box、Slipcase 与中性模型。尺寸均为名义参考，不代表实物测量或所有厂牌的特殊结构。

```sh
blender --background --python design/album-packaging/build_library.py -- --output static/models/packaging --blend-output /tmp/cd-blend-sources
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web test
```

纸脊是有厚度的连续网格，形状键与折页轴心使用同一条弧线。三/四板片封面先打开，内折页随后展开，反向时先收纳内页。测试直接读取部署 GLB，在多个中间状态及反向接管中核对接缝闭合、固定托盘不移动、封面朝外和共享资源不含图片。可编辑 `.blend` 输出是开发资料，不需要随服务部署。

内开口 CD Wallet 模板用两个压痕连接平直纸脊，展开至平面；左右纸袋的缺口朝书脊，保留独立纸边、闭合粘接边和两张 120 mm CD。行业的 4-panel 指四个印刷面，这里仍是两块折页。名义比例 138 × 125 mm 只是参考，不写入副本的实测尺寸。`photoRegions` 可把同一张完整展开照的两块印刷面投影到模型上，原文件像素保留；`album-photo-projection.ts` 计算透视映射，`album-photo-material.ts` 在片元中应用，避免两三角之间的贴图折线。图片只存入副本照片目录，共享 GLB 不嵌入实物图或封面。

内开口纸套的外脊 `spine` 和内折脊 `insideSpine` 使用独立材质；纸边保持未印刷。双袋模板的平直纸脊参考宽度为 4.6 mm，纸层、袋腔和光盘间隙同步收窄，名义闭合厚度约 5 mm；这些仍为模板参考值。多碟堆叠按实际容纳数增加间距。

同一展开原照同时提供左右内页与已校准的内折脊时，内开口纸套从内折脊区域取样纸色，用于未印刷内衬和纸边；兼容旧的同源 `spine`。同源照片在每次灯箱中只请求、解码一次，每个校准面先分配独立 GPU 贴图区域，再逐级过滤缩小。取样与内存贴图裁取不修改原照片，也不推断没有拍到的背面或完整盘面。

光盘分成印刷/金属环与透明夹持圈，保留 15 mm 中心孔。印刷不覆盖透明中心圈，避免把扫描仪白色反射当作白墨。反射环使用连续平面 UV、径向各向异性和宽频带衍射近似；不把微观沟槽逐条建模，以避免摩尔纹。`album-disc.ts` 保持盘体与中心圈一起取放、独立旋转和返回当前折页原位；收回后才闭合包装，支持连续反向与减少动态效果。印刷原图的小字清晰度是复现上限，未提供的反面刻码不生成。

## 标准 Jewel Case 的结构依据

`build_jewel_study.py` 在 Blender 5.2 中建立三件式结构：固定后壳、固定托盘、可转动透明盖。名义尺寸为 142 × 125 × 10.4 mm；用于比例参考，不代表任何收藏副本的实测值。

- 托盘左侧的凸起纹理脊条保持固定。盖板避开这一区域，盖板上下两侧的延伸耳与后壳销孔配合。
- 脊条的厚度与圆角保留几何；微小齿纹使用连续 UV 表面的凹凸材质。网页按像素覆盖范围过滤纹理，放大时表现细齿，缩小或倾斜时平滑减弱，避免密集棱柱产生摩尔纹；正式灯箱与独立网页样板共用 `album-rib-material.ts`。
- 旋转轴穿过上下销轴的实际中心；原模型把纹理区也归入活动盖的问题不再沿用。
- 壳体有壁厚、圆角、嵌套边沿、真实销孔和盖内的纸册卡舌；相邻透明部件使用布尔并集，避免内部重叠面产生虚假的反射。
- 托盘有盘面凹槽、手指缺口、中心卡爪；CD 有真实中心孔。透明塑料使用折射材质，纸册为独立贴图表面。
- 上下挡边沿圆盘轮廓避让，盘槽外圈限制在托盘矩形边界内并与托盘连接；CD 的直径保持 120 mm。导出模型测试检查多个开合位置下的上下边缘间隙，避免挡边与盘面共面或穿入圆盘。
- 输出可编辑的 `.blend`、包含盖板旋转动画的 `.glb`、四张检查图与 `geometry-report.json`。脚本检查整个开合过程中销轴中心不漂移、固定托盘不移动。

结构参考：[标准盒的三件式结构与固定前脊条](https://patents.google.com/patent/EP1976777A2/en)、[销轴、侧耳、销孔及标准厚度双碟托盘](https://patents.google.com/patent/EP0977202A1/en)。这些资料用于识别标准结构；具体品牌和版次仍须用实物照片或测量核对。

## 生成与检查

在本目录外指定输出目录，运行：

```sh
blender --background --python design/album-packaging/build_jewel_study.py -- --output /tmp/cd-study
```

可选 `--textures <临时样例目录>` 读取 `0.png`（正面）、`1.png`（背面）、`3.png`（册页中面）。示例贴图必须使用非个人的临时样例；缺少贴图时使用纯色材料。生成脚本不连接 API，不查找或修改 `data/`。

`study.html`、`study.css`、`study.js` 是独立网页预览源。用 Three.js 0.186.1 和 esbuild 将 JS 编译为 `study.bundle.js`，与 HTML、CSS、GLB 一起放入输出目录，再用独立的标准库 HTTP 服务访问。单击开合、拖动/方向键旋转、滚轮放大、Home 回正。网页使用的就是导出的 GLB，不能用 Blender 静态渲染图代替网页材质验收。

独立 `study.html` 仍为结构样板，未接入账本感应、历史和资源回收；正式应用通过下面的入口实现这些行为。浏览器方向事件及桌面检查均不构成手机实机帧率验收。

## 正式实现入口

Blender 负责几何、UV、枢轴和动画，网页用 Three.js/GLTFLoader 加载 GLB。服务器只提供静态资源，仍保持 Python 标准库运行时；部署无需安装 Blender。GLB 支持的材质须在网页核对，复杂 Blender 节点和渲染效果不能假定会原样导出。[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[网页透明材质](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)。

模型按包装结构共享，专辑只替换本副本的封面/照片贴图。`web/src/core/album-model-assets.ts` 负责结构选择与照片身份，`album-scene.ts` 按需加载 Three.js/GLB、绑定 UV、材质、动画并释放资源，`components/AlbumModel.tsx` 负责直接操作与已有感应接口；`CSSAlbumModel.tsx` 是 WebGL 不可用或模型载入失败时的简化回退。沿用 `packaging` 的专业名称、结构选项与照片角色，不批量改写旧记录。

打开后才创建渲染器和载入当前类型；材质只加载当前可见结构使用的本副本贴图，GPU 贴图尺寸有上限。静止时不保持动画循环，后台暂停，关闭时中止请求、释放几何/材质/贴图/环境图/动画/渲染器。现有设备方向权限、背景/Esc/返回关闭、浏览位置恢复与漫游暂停保持共用。

各类模板的结构与核对边界：

| 专业结构 | 建模重点 |
| --- | --- |
| Slimline / Multi-CD Jewel Case | 各自壳体结构与托盘；不能只拉伸标准盒，不能由 2CD 推断厚盒 |
| Card Sleeve | 薄纸板、粘合边、单侧开口与内部纸套；没有翻页盖 |
| Gatefold Sleeve / Digisleeve | 连续纸脊、压痕与折线、口袋、正确折页顺序；连接处不能是两块厚板的空隙 |
| Digipak | 连续折叠纸壳与独立塑料托盘，托盘粘合在纸板上 |
| Digibook | 包背、沟槽、封板与纸页块的连接；不能把纸页块当作厚盒盖 |
| Rigid Box | 裱纸包覆、盒壁、折返边与套盖间隙，按套盖/翻盖实物区分 |
| Mini LP / Slipcase | 保持独立属性；Mini LP 跟随真实纸套结构，Slipcase 为独立外部抽套 |
