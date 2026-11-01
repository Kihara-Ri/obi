# 2026-11-01 · 实物照片逐张暂存上传（保存请求不再背 base64）

## 背景

添加 / 编辑专辑时，新照片压成 data URL 后全部塞进保存请求的 JSON 里：30 张就是几十 MB，
手机上请求又大又慢，任何一张出问题整次保存失败，用户得重填表单。备份包早有整文件上传通道
（`apiUpload` / `routes.UPLOAD`），照片却还在走 JSON。

## 改了什么

照片在压缩完成后立刻上传到私有暂存区，账本保存时只提交引用；保存成功才把暂存字节写进
`data/photos/<id>/`，失败或放弃都不会留下账本记录。

前端：

- `web/src/core/photo-transfer.ts`：`PhotoTransferQueue` —— 两条并发泳道，按槽位 token 幂等重试
  （同一 token 只传一次，同内容重传服务端接受、不同内容报「标识已被使用」），单次 120s 超时，
  5xx / 408 / 429 重试一次，其余错误立即上抛；`dispose()` 统一取消在途请求。
- `web/src/forms/PhotoSlots.tsx`：压缩回填时顺手入队；槽位带 `transfer: 'uploading' | 'failed'`
  与 `upload: <ref>`；`prepare()` 在保存前汇总（有失败先重试、等所有在途任务、仍未完成则明确报错）；
  `retry()` 只补失败的照片。
- `web/src/forms/record/buildPayload.ts`：`photos` 项从 data URL 变成 `{upload: ref}`，旧照片仍是序号。
- `web/src/forms/record/PhotoEntry.tsx` / `RecordForm.tsx`：照片区状态行显示「处理照片中 / 上传 3/8 /
  2 张未上传」，失败时出现「重试上传」；保存按钮在等上传时显示「上传照片中…」；保存期间表单 `inert`。
- `web/src/core/api.ts`：`apiUpload` 支持 `AbortSignal`；网络中断不再吞成「操作失败」，改为
  「连接中断，保存结果尚未确认；请保留当前页面，恢复网络后核对」，空响应体单独报错。
- 本机模式（Pyodide）不分叉：`isLocalSite()` 为真时仍走原来的 data URL，因为浏览器里没有
  HTTP 上传通道。

服务端：

- `photo_uploads.py`（根目录业务模块）：`stage()` 校验 8 MB 上限与 JPEG/PNG/WebP 魔数后原子写入
  `data/.photo-uploads/<token>`，同名同内容视为重传（刷新 mtime），同名不同内容拒绝；`staged_bytes()`
  读回时再校验 TTL（24h）与大小；只清理这个私有暂存目录里的过期文件。
- `server/routes.py`：`UPLOAD` 表加 `/api/photos/stage`（`MAX_BYTES`），复用「请求体即文件」的
  落盘通道，和恢复备份同一条防线（须登录、持写锁、只认 `application/octet-stream`）。
- `storage.py:prepare_photos`：新增 `{'upload': token}` 分支，交给 `staged_bytes()` 取字节；
  校验仍在任何文件改动之前完成，回滚语义不变。
- `server/http.py`：整文件上传的 415 / 413 / 500 文案改成通用说法（不再只提 zip）。
- `deploy/nginx.conf.template`：`/api/photos/stage` 单独放宽到 `client_max_body_size 8m`、
  `client_body_timeout 180s`，保留请求缓冲，收完才交给 Python。

## 怎么验证的

- `tests/test_photo_staging.py`：暂存校验（token 格式、魔数、8 MB、重传幂等、TTL 过期）、
  `storage` 保存时读取暂存并落盘、过期/伪造 token 被拒。
- `web/tests/photo-transfer.test.mjs`：并发泳道、幂等、失败重试与取消、`prepare()` 语义。
- `web/tests/record-metadata.test.mjs`：`{upload}` 引用进 payload、旧照片仍用序号。
- 全量：`python3 tools/run_tests.py` 565 项全绿；`npm --prefix web run typecheck && npm --prefix web run build` 通过。

## 可能带来的新问题

- 暂存文件不随保存删除，只靠 24h TTL 与每次 `stage()` 时顺手清理；放弃的表单会在 `data/.photo-uploads`
  里留最多 24 小时（单张 ≤ 8 MB）。这是有意的取舍：重试、换表单再保存都能复用同一份字节。
- 本机模式与服务器模式的照片提交路径不同（data URL vs 引用），改 `buildPayload` 时两边都要想一遍。
- 暂存目录不进备份（`backups.py` 只打包 `photos/`），未保存的照片本来也不该进备份。

## 关联

`docs/log/2026-11-01-photo-staging-root-module.md`（同一功能的模块分层修正）·
`docs/log/2026-10-30-save-deployment.md`（整文件上传通道）
