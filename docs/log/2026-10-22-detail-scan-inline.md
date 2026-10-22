# 详情里识别条码：不再跳查询页，改为打开编辑表单就地查询

- `LightboxScan` mode `lookup` → `detail`：识别后发 `detail-barcode` 事件；`DetailDrawer`（当前可见的那一页）收到后 `queueRecordBarcode` 并 `openRecordForm`；`ReleaseLookupSection` 挂载时 `takeRecordBarcode` 取走，填入并就地查询，先于照片自动识别。
- 查询页的 `queueLookup` 通路不再有调用方，保留未删。
- 未验证：真机整条流程。
