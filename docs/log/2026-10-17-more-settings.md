# 2026-10-17 · 「更多」与「设置」重做

- **作者**：Claude
- **范围**：`pages/{MorePage,SettingsPage}.tsx` `pages/settings/*` `components/{ModuleChooser,ThemeToggle,InstallNavItem,icons}` `components/ui/{NavRow,Disclosure,TabPanel}` `styles/{more,settings}.css`

## 改了什么
更多页：一行一件事（图标、名称、右侧数字），无副标题；设置页：分段标签页（功能/数据/高级/账户），说明性文字折叠，切换标签内容按方向滑入；功能模块：基础收藏常开 + 四个开关，海外周转缩进在购入记录下表达依赖，去掉「快速选择」；新增 NavRow / Disclosure / TabPanel。

## 出现的问题
更多页层级乱、设置页 8 个区块滚 3.6 屏、说明文字过多、模块选择有重复逻辑。

## 怎么解决的
按「少字多图」重排；拆出 DataSettings / AccountSettings；首次引导页的方案卡片保留。

## 可能带来的新问题
设置页每次进来停在「功能」，标签不写入 URL；「高级」页「发行资料自动匹配」卡片标题与内容不完全对应（标题被测试固定）；本提交不含未提交的 Album Engine 设置区块，其接入需在「高级」标签里补上。

## 关联
I-005
