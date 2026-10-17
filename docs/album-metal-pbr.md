# 收藏纪念卡：轻度仿真拉丝金属

## 目标

接近真实缎面/精细拉丝金属，而不是将加工纹理画成清晰的同心圆或唱片沟槽。保留银色与金色统一的顶部柔亮、中央宽亮带和边缘渐暗结构，拉丝纹仅在反射中隐约出现。

## 渲染架构

- `web/src/components/BrushedMetalTexture.ts`：一次生成 1024×1024 的三张 CanvasTexture：`color`、`roughness`、`anisotropy`。色彩图中的划痕信号只有微观沟槽噪声的 18%，粗糙度也只有轻微起伏；不再把强条纹直接加到色彩上。
- `anisotropy` 贴图按每个像素相对于画面上方加工中心的圆弧切线编码方向，写入 RG；B 通道控制较温和的强度。Three.js `MeshPhysicalMaterial` 的各向异性反射因此能够沿弧形加工方向变化，而不需要绘制强烈的色彩曲线。
- `web/src/components/MetalBackCanvas.tsx`：使用 `map`、`roughnessMap`、`anisotropyMap`、`emissiveMap`；`metalness=1`、`roughness=0.40`、`anisotropy=0.48`。场景 HDR 环境强度为 0.20，材质 HDR 反射强度为 0.17，保留轻微角度相关反射，不出现随鼠标追踪的聚光灯。
- `web/src/styles/album-flip-card.css`：静态 CSS 后备保持中央较亮、两侧暗，只有 WebGL 无法启动时才取代纹理显示。

## 状态、资源和性能

金色和银色使用一致的微观结构，只改变基底色与弱补光。对专辑设置「我喜欢」时，用新的三张贴图同步替换材质中的 `map`、`roughnessMap`、`anisotropyMap` 和 `emissiveMap`，再释放旧贴图。退出预览后清理所有纹理、几何体、材质、HDR 环境和 WebGL 上下文。

首次翻到背面才生成纹理及创建 WebGL，鼠标只控制轻微倾斜，倾斜停止则暂停渲染；像素比上限 1.25。封面正面保持原图片、DOM 文字和翻面逻辑不变。

## 验证

- `node --test web/tests/brushed-metal.test.mjs`
- `npm --prefix web run typecheck`
- `npm --prefix web test`
- `npm --prefix web run build`
- 用本机 Chrome 检查金银两色静止和倾斜画面、Canvas 已渲染、无运行时错误。

环境贴图：Poly Haven [Studio Small 05](https://polyhaven.com/a/studio_small_05)，CC0 1.0，随项目本地提供。
