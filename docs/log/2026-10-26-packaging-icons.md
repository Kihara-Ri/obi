# 2026-10-26 · 包装类型配图标与中文名；表单改为点选

- **作者**：Claude
- **范围**：新增 `components/PackagingIcon.tsx/.css`（`PackagingIcon` / `PackagingLabel` / `PackagingPicker`）；`core/album-packaging.ts`（`PACKAGING_ZH`、`packagingKind`、`packagingDisplay`）；`ui/OptionCards` 加 `columns`；`ReleaseMetadataFields`、`ReleaseDetails`（含「包装待核对」确认）、`DetailDrawer`、`detail/ReleasePage`、`AlbumSummary`、`types.ts`（`labelTags` / `metaTokens`）；`REGISTRY.md`、`CHANGELOG.md`

## 出现的问题
用户反馈：详情与发行资料页的包装只显示「Jewel Case」这类英文术语，不直观；手动更正发行资料里包装是自由文本输入框。

## 怎么解决的
1. 每种预设包装（标准 / 薄 / 多碟塑料盒、单口 / 对折 / 三折纸套、纸盒带托盘、精装书本、硬纸盒、迷你 LP 纸套）画一个线性示意图（塑料盒看厚度，纸套看开口，折页看面数），另有「其他」「不清楚」。
2. 显示：详情「包装」行与发行资料页「规格 · 包装」= 图标 + 中文名，原术语小字在下；列表行、展示墙标签、销售卡片等文字摘要改用中文名（列表行带小图标）。MusicBrainz 名称（Cardboard/Paper Sleeve、Slim Jewel Case、Gatefold Cover、Book、Box、Fatbox 等）映射到对应预设；认不出的（Keep Case 等）显示中文俗称或原文。
3. 填写：手动更正发行资料里的包装输入框换成三列 `OptionCards` 图标卡，点选即存预设英文术语（存储口径不变，仍走 `ReleaseDetails` 的预设 → 结构规格联动）；资料库里认不出的原值单独一张卡保留选中；发行资料没写包装时按副本已有包装预选。「包装结构待核对」的下拉也换成同一组图标卡。

## 验证
前端 typecheck / build / 155 项测试通过（新增包装名映射测试）；样本库 375×812：列表行显示图标 + 中文名，详情「包装」行显示图标 + 「标准塑料盒 / Jewel Case」，编辑 Islands 时预选「迷你 LP 纸套」，点「对折纸套」后选中切换（未保存）。

## 可能带来的新问题
中文名是本次拟定的显示用词，用户可再调整；存储与 3D 结构判断不变。「不清楚」会清空发行资料里的包装文字。
