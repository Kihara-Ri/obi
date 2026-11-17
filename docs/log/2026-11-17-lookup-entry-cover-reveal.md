# 2026-11-17 · 库存搜索直通查询页；封面改为模糊到清晰

- **作者**：Claude
- **范围**：`web/src/pages/ShelfPage.tsx`、`web/src/styles/shelf.css`、`web/src/pages/MorePage.tsx`、`web/src/core/cover-reveal.ts`（新）、`web/src/core/burn-reveal.ts`（删）、`web/src/styles/components.css`、`web/src/pages/AlbumResults.tsx`、`web/src/components/ReleaseCandidateCard/ReleaseCandidateCard.tsx`

## 出现的问题
1. 查询入口藏在「更多 › 编号查询」，名字也只说编号，实际能查条码、编号和专辑名；在库存里搜不到某张时，要退出去再进查询页重新输入。
2. 查询结果封面的「燃烧」显现动效常常狂闪、效果也不明显。原因：每一帧都用 canvas 画一张 40×40 的遮罩再转成 dataURL 设为 `mask-image`，浏览器每帧都要重新解码一张新图，手机跟不上时这一帧就没有遮罩或整图消失，于是闪；整个过程不到 1 秒、遮罩格子又粗，看起来只是「抖一下」。

## 怎么解决的
- 库存页搜索有内容时，列表上方显示「在资料库查「…」 ›」，点了把搜索词带进查询页直接查。「更多」里的入口改名「查询」，副标题「条码 · 编号 · 专辑名」。
- 删掉燃烧动效，改为纯 CSS 的「模糊到清晰」：透明 + 模糊 10px → 清晰，约 0.38 秒，只播一次；系统开了「减少动态效果」时不播。

## 验证
前端 193 项、tsc、build。样例数据下在库存搜「Meddle」→ 点新入口 → 跳到 `#lookup` 并出结果；逐帧采样 151 帧，封面不透明度只升不降（无闪烁），模糊从约 8px 平滑到无，无页面报错。手机尺寸截图确认入口行与结果页。

## 可能带来的新问题
封面图本身加载慢时，动效在图片到达后才开始，仍可能先看到占位底色。
