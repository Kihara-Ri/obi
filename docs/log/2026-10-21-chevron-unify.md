# 2026-10-21 · 箭头与折叠统一；少选项筛选改分段控件

- **作者**：Claude
- **范围**：`components/ui/Chevron`（新）、Dropdown / Combobox / Disclosure / NavRow / Tracklist / ShipmentStack / ArtistButton / ArtistProfile / GalleryPage / ShowcaseGroupForm / 详情与管理页入口、`CoverPanel`、`ListingSettings`、`ShelfPage`、`TradesPage`

## 现象
箭头有五六种：`ChevDownIco` SVG、Tracklist 自带的另一个 SVG（15px）、`›` `▸` `▾` 文字字符、我上一轮加的 CSS 画的 `.chev`；尺寸、粗细、动画各不相同。折叠列表也出现了和已有 `Collapse` 重复的 `.fold-box`。

## 改动
- 新组件 `Chevron`：同一个 SVG、固定 14px、`--dur` + `--ease-out` 旋转；`down` 展开转 180°，`right` 展开转到朝下。
- 所有下拉 / 折叠 / 进入下一级的箭头改用它；删除各处自带的箭头 CSS 与字符。
- 折叠列表统一用 `Collapse`，删掉重复的 `.fold-box`。
- 筛选「上架（3 项）」「交易状态（4 项）」改为 `Seg` 分段控件：一次点击切换；手机上独占一行。排序（含长文案「成本从高到低」、且很少改）保留下拉。

## 验证
typecheck、web 测试、构建通过；未在真机确认视觉与动画。
