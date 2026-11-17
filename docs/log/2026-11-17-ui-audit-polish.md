# 2026-11-17 · 全站页面与表单检查后的统一修整

- **作者**：Claude
- **范围**：`core/release-metadata.ts`（`displayRegion`）、`types.ts`（`labelTags` 入参放宽）、`components/Cards.tsx` / `Cards.css`、`components/ArtistProfile.tsx`、`styles/artist-entry.css`、`pages/ShelfSummary.tsx`、`components/PageHead.tsx`、`pages/StatsPage.tsx`、`pages/TradesPage.tsx`、`pages/PendingReleases.tsx`、`pages/LedgerChart.tsx` / `.css`、`pages/ShipmentCard.tsx`、`components/ModuleChooser.tsx`、`components/ModulePresets.tsx`、`components/AppNav.tsx`、`pages/MorePage.tsx`、`pages/LookupPage.tsx`、`forms/RecordForm.tsx`、`forms/record/ReleaseLookupSection.tsx`、`styles/drawer.css`、`styles/sales.css`；测试 `web/tests/release-metadata.test.mjs`

## 出现的问题
用户让检查所有页面和表单。样例数据下手机 / 桌面逐页截图后发现：桌面卡片的包装写英文（Digipak），手机同一张写中文（纸盒带托盘）；地区同屏既有「日版」又有「日本」「德国」；「待确认版本 / 待确认发行版」「售出金额 / 售出到手」、三种导出按钮叫法不一；查询框占位文字在手机上被截断；添加专辑在确认版本前有空的「这一张」标题；编辑包裹的提示框贴着「备注」、修改销售费用的封面行挤在一起；库存统计卡「8 张」与导航数字重复，桌面卡片每张都压着勾选框、卡片里多一行「艺人」标签、横滑行被截断却看不出能滑；账本图例写成「+N 当月利润」、月份少时宽屏左挤；在途包裹的「撤销」不知撤什么、备注被折成半句；设置里「我全都要」像孤立标签、保存按钮离控件很远；「数据保存在服务设备」用词别扭。艺人页副本行的状态与标签之间还缺分隔符。

## 怎么解决的
桌面卡片与艺人页改用同一个 `labelTags`；`displayRegion` 统一输出「X版」。其余按上面逐项改文字、条件渲染与少量 CSS（详见定案「列表文字统一」「库存与表单细节」与设置条）。

## 验证
后端 637 项、前端 194 项（地区测试改为「X版」口径并补表外代码）、tsc、build。样例服务器手机 / 桌面 11 个页面重新截图无横向溢出、无控制台错误；添加专辑、编辑包裹、修改销售费用抽屉复查截图。

## 可能带来的新问题
列表里不再出现「日本 / 美国」这种完整地区名（详情页仍有）。桌面勾选框改为悬停出现（只对有鼠标悬停的设备生效，触屏平板仍常显）。横滑渐隐依赖滚动驱动动画，旧浏览器没有渐隐。
