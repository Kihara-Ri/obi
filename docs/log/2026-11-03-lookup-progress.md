# 2026-11-03 · 查询页进度卡

- **作者**：Claude
- **范围**：新增 `components/LookupProgress/`（tsx + css + `sourceIcons.ts`）、`styles/tokens.css`（`--brand-plate`）、`core/lookup.ts`（`LOOKUP_SOURCES`）、`pages/LookupPage.tsx`、`components/REGISTRY.md`、`docs/界面与功能定案.md`、`CHANGELOG.md`

## 出现的问题
用户给了一张参考图（「正在自动选择数据源」卡片：转圈、标题、右侧胶囊按钮、分段进度条、「已查找：」+ 来源图标），希望查询时仿照。原来查询中只有一行小字「查询中 · MusicBrainz / …」。

## 怎么解决的
新组件 `LookupProgress`：转圈 +「正在查询 N 个资料库」+ 进度条（末端小圆点）+「查找：」后列资料库官方图标（悬停 / 读屏给全名）。参考图的「手动选择」在本应用没有对应功能，换成「取消」：中止请求并回到查询前的界面。来源清单集中到 `LOOKUP_SOURCES`（条码 MB/Deezer/iTunes，编号 MB/Discogs/NDL，文字 MB/Discogs）；编号查不到转文字搜索时卡片随之换成 2 个来源、进度条重新开始。输入框 × 清空改走同一个 `cancel`，顺带修掉清空后冒出「查询超时」的问题。

## 可能带来的新问题
- 后端一次返回全部来源，进度条只按时间渐近（14 秒到 90%），不是真实进度；若以后后端改为逐来源返回，可把徽标改成逐个点亮。
- 来源清单与后端 `ReleaseCatalog.backups` 两处维护。
- 图标起初是字母徽标，用户确认后改为官方图标：与购买渠道图标同法，一次性取官网图标缩成 48px PNG、内联 data URI（共约 24 KB 源码），不改 CSP、无运行时外部请求。Discogs 官网拒绝直取，经 Google favicon 服务获取。白底圆形（`--brand-plate`）保证深色模式下透明底图标可见；MusicBrainz / Deezer / NDL 留 4px 边距不被圆裁。各站换 logo 不会自动跟进；Apple 的品牌使用规定最严，若有问题可单独换回字母。

## 验证
typecheck、build、分层测试通过；样本库浏览器实测（375 宽、浅色 / 深色）：编号查询显示 3 个来源、转文字后显示 2 个，「取消」后回到最近查询与待确认列表，无报错，console 零错误。

## 关联
无
