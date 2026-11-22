# Agent 上架接口

服务器版开启「二手交易」后，Agent 可以查库存副本、取得发行资料和原图、保存上架草稿。调用方自行选择模型和发布工具。Obi 把草稿留在副本的「编辑上架资料」中，上架状态由用户确认实际发布后记录。见 D-045。

## 开通

在服务端数据目录（Docker 内为 `/data`）的 `credentials/listing-agent.token` 保存一枚独立令牌。用 `python3 -c 'import secrets; print("obi_listing_" + secrets.token_urlsafe(32))'` 生成，文件仅允许服务用户读取。重启 Obi 后生效。删除文件并重启可关闭接口，换令牌也需要重启。令牌随服务端配置管理，账本备份只包含账本和业务资产。

所有请求都带 `Authorization: Bearer <TOKEN>`。远程使用既有的 HTTPS 地址，本机可使用回环 HTTP。Agent 只需要这枚令牌。本机浏览器或安卓版本不运行这个 HTTP 服务。

## 请求与响应

前缀为 `/api/listing/agent`。接口中的 `id` 对应一张实物副本。

| 方法和路径 | 查询或请求字段 | 响应 |
| --- | --- | --- |
| `GET /copies` | `q` 必填。可选 `by=text\|barcode\|catalogNumber`，默认 `text`。可选 `offset`，默认 0。 | `copies` 为候选列表，每页最多 20 项。每项包含 `id`、`title`、`artist`、`catalogNumber`、`barcode`、`version`、`pressing`、`obi`、`status` 和 `listed`。用 `nextOffset` 请求下一页，末页为 `null`。 |
| `GET /materials` | `id` | 返回 `id`、`revision`、`photoRevision`、`photoCount`、`photoOrder`、`listed`、`facts`、`writingPreset` 和 `draft`。 |
| `GET /photos` | `id`、`photoRevision`、`order`。图片序号从 0 开始，以逗号分隔。 | `application/zip`。ZIP 内是指定顺序的原格式图片，第一张用作首图。有序子集也可下载。 |
| `POST /draft` | JSON 包含 `id`、`revision`、`photoRevision`、`title`、`description`、`photoOrder`。可选 `replaceExisting`，默认为 `false`。 | 保存成功返回 `id` 和新 `revision`。再次读取 `/materials` 可核对已存内容。 |

- 查找范围是国内与海外库存。文字模式匹配艺人和专辑名，条码和唱片编号做精确匹配并沿用发行检索的格式归一化。找到多张副本时请用户选定一张。
- `facts` 沿用售卖模块的发行资料白名单，包括专辑、发行版和本副本的包装等字段。`writingPreset` 提供默认风格的 `id`、`name` 和 `instructions`。`draft` 为当前保存的标题与正文，空白时为 `null`。
- `photoOrder` 为从 0 开始且互不重复的序号数组。资料接口优先返回照片版本仍有效的保存顺序。没有图片时用空数组并跳过下载。首图由顺序决定。
- 写作遵循[售卖草稿定案](界面与功能定案.md#售卖草稿2026-10-28-更新d-031)。正文以已知发行资料和实物证据为准。买入价格、渠道、私人备注、模型凭据由 Obi 保留。
- 草稿写入核对记录和照片版本。带旧版本的请求返回 400，重新取资料再判断。已有文案而未明确允许替换时返回 409。保存请求超时后先读取草稿核对结果，再决定是否重试。
- 启用接口时，缺少有效令牌返回 401。令牌文件不存在时返回 404。二手交易关闭时返回 400。失败响应统一是含 `error` 的 JSON。

## 单件流程

1. 查找候选，选定副本后读资料和照片。
2. 写标题和正文，按顺序保存选用的图片序号。用同一份资料的记录和照片版本保存草稿。
3. 回读草稿，再把文案和已下载的图片交给发布工具。价格、运费、类目和发货地由调用方在发布环节准备。

## 闲鱼交易同步

外部系统负责上架、核对在线状态及跟踪订单。Obi 接收已核实的事实，并应用账本里的上架、售出和确认收货事务。见 D-046。

### 单独启用

在服务器数据目录的 `credentials/trading-agent.token` 写入交易令牌。用 `python3 -c 'import secrets; print("obi_trading_" + secrets.token_urlsafe(32))'` 生成，权限为 `0600`，服务重启后生效。删除文件并重启可关闭。每个下文请求使用 `Authorization: Bearer <TRADING_TOKEN>`，远程使用既有 HTTPS 地址。草稿令牌和交易令牌各自只授予本节或上文列出的能力。

交易同步也要求开启「二手交易」。错误返回 `{"error":"…"}`。停用接口返回 404，令牌无效返回 401，字段无效或模块关闭返回 400。遇到副本版本、商品绑定、订单或到账日期冲突时返回 409，由调用方保留事实供核对。

### 登记上架回执

`POST /api/listing/agent/receipts` 需要已回读确认在线的商品。使用本副本最新的 `revision`。首次接入时，已有相同闲鱼链接的库存副本也可以登记回执。

```json
{
  "id": "0123456789abcdef0123456789abcdef",
  "revision": 2,
  "itemId": "100000000001",
  "status": "online",
  "price": "95.00",
  "shipping": {"mode": "free"},
  "verifiedAt": "2026-10-08T05:30:00Z"
}
```

- 运费方式为 `free`（包邮）、`fixed`（固定运费，须带 `amount`）、`actual`（按实际计费）或 `pickup`（自提）。`verifiedAt` 为带时区的 ISO 8601 时间。金额均为人民币字符串，最多两位小数。
- 200 返回 `id`、`itemId`、`price`、`shipping`、`verifiedAt`、规范商品 `url`、最新 `revision` 和 Obi 的 `listed` 标记。同一商品只能绑定一张副本。重试可原样发送首次回执，含原 `verifiedAt`。重复回执返回原回执和当前标记，下架后重试也保留当前标记。

### 登记已付款订单

`POST /api/trading/agent/orders` 以闲鱼平台订单号为键。`itemId` 对应已上架的库存副本，支持已有的闲鱼商品详情链接。`date` 是付款日期。`gross` 是订单的实际成交价。`fees` 为平台扣费，`postage` 为卖家支付的寄出运费，省略时按现有销售单规则使用 `0.00`，实际费用可在账本补录。

```json
{
  "orderId": "DEMO-XIANYU-001",
  "itemId": "100000000001",
  "date": "2026-10-09",
  "gross": "90.00",
  "fees": "3.00",
  "postage": "7.00"
}
```

付款事实建立「售出中」销售单。同订单号同内容重试返回同一销售单当前状态。若已有手动销售单，Obi 核对订单号、关联的单件副本、币种、成交价、日期并返回已有单据。费用修改通过账本原有入口生效。上架标价与实际成交价分别保存。

### 同步收货与到账

`POST /api/trading/agent/settlements` 至少提交一项已核实的事实。以买家确认收货或平台确认收货的结果填写 `buyerReceived`。以实际到账日期填写 `settledDate`。物流信息由调用方保留。

```json
{"orderId": "DEMO-XIANYU-001", "buyerReceived": true, "settledDate": "2026-10-14"}
```

- 两项事实可以按任意顺序分次提交。仅有一项时销售单保持「售出中」，两项齐全时按实际到账日期转为「已交易」。重复发送任意一项返回当前单据状态。订单还没登记时返回 409，调用方可先登记付款，再重试已核实的事实。
- 订单登记和结算响应包含 `saleId`、`orderId`、`status`（如 `shipping` 或 `complete`）、`buyerReceived` 和 `settledDate`（尚未到账时为 `null`）。同号历史销售单有多笔或已退款、退货、撤销时，自动确认收货返回冲突。手动撤销退款后，重新核实并上报两项事实。

### 固定样本验证

在仓库根运行 `python3 -m unittest discover -s tests -p test_trading_agent.py`。测试在临时数据目录用 Obi 固定样本和本机 HTTP 跑回执、售出及结算，并覆盖事实乱序、并发重复订单、历史链接、旧销售单和令牌隔离。测试数据中的商品号、订单号和金额均为虚构值。
