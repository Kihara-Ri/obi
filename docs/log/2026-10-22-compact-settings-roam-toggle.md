# 展示设置 / 展示范围用内容高度的抽屉；漫游改胶囊按钮

- 「展示设置」「选择展示范围」抽屉由整屏高改为 `compact`（按内容高度，最高仍受屏高限制并可滚动）。展示方式（9 个缩略图）仍是整屏。
- 漫游控件：iOS 式拨动开关 → 与工具栏其它按钮同款的胶囊按钮（`aria-pressed`；关 = 描边空心点，开 = 强调色底 + 实心点）。移除 `.gallery-roaming-switch*` 样式，重写 `tests/gallery-roaming-switch.test.mjs`。
- 未验证：真机观感；compact 在桌面宽度下的表现。
