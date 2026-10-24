# 2026-10-24 · 去掉详情照片灯箱里的「识别条码并查询」

- **作者**：Claude
- **范围**：`components/ui/Lightbox.tsx`、`LightboxScan.tsx`、`forms/DetailDrawer.tsx`、`forms/record/ReleaseLookupSection.tsx`、`core/lookup-handoff.ts`、`REGISTRY.md`

## 改了什么
详情照片墙（`.photo-strip`）打开灯箱时不再显示该按钮。随之删掉只为它服务的链路：`LightboxScan` 的 `detail` 模式与 `detail-barcode` 事件、`DetailDrawer` 里的监听、`lookup-handoff` 里的 `queueRecordBarcode` / `takeRecordBarcode`、发行版区块挂载时取走条码的逻辑。

## 没动的
编辑表单里照片灯箱的「识别条码并核对发行版」（`record-barcode`）与表单里的「从照片识别条码」自动 / 手动识别保持不变；查询页的 `queueLookup` 不变。旧日志里对 detail 模式的描述是历史记录，不改。

## 可能带来的新问题
无已知；详情页不再能一步从照片跳到编辑表单查条码，需从编辑表单走。
