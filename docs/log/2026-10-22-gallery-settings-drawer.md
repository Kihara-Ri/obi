# 展示设置：改用抽屉；补回「显示标题与艺术家」入口

- 底部面板 / 下拉浮层都用 position 定位，被页面容器与底栏裁掉（最后一行「显示标题」看不到），里面的下拉列表也被遮挡。改为与「展示方式 / 展示范围」同一套抽屉（`components/GallerySettings`）。
- 展示顺序、封面大小改用 `Seg`（选项少，不再用下拉）；「显示标题与艺术家」是开关行，带一行说明；漫游开启时多一行速度 / 间隔。封面墙与桌面铺开有开关，瀑布流提示始终显示。
- 移除 gallery.css / gallery-roaming.css 里的浮层 / 底部面板 / `.gallery-setting` / `.gallery-check` 样式与 GalleryPage 里的 adjusting 状态。
- 未验证：真机。
