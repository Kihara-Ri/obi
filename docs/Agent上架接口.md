# Agent 资料包与交易同步接口

服务器版开启「二手交易」后，Agent 可查找库存副本并下载上架资料。文案、选图、发布与订单监听由外部系统完成，Obi 接收其回报的交易事实。已存商品链接可从专辑详情 → 管理打开。见 D-047。

查询持有、在途或已售的购买记录使用独立的[已购唱片查询接口](已购唱片查询接口.md)。从找副本到入账的完整调用顺序见[接口场景指南](接口场景指南.md)。

## 启用资料包

给调用方签发一枚带 `listing:read` 权限的令牌（见[对外令牌](对外令牌.md)），立即生效，不用重启。同一个 Agent 还要回报上架和订单时，一并挂上 `trading:write`：

```sh
docker compose exec obi python3 -m server.client_admin add 上架Agent --scope listing:read --scope trading:write
```

`revoke` 立即撤销，`rotate` 换新令牌。令牌由实例管理，清单只存摘要，账本备份只包含账本与业务资产。旧方式 `credentials/listing-agent.token`（`obi_listing_` 前缀，重启后生效）仍按 `listing:read` 识别，可用 `import-legacy` 迁移。

资料包请求带 `Authorization: Bearer <令牌>`。远程使用实例的 HTTPS 地址，隔离本机测试可使用回环 HTTP。浏览器本机模式与安卓本机模式不提供这两个 Agent 能力。

## 查找与下载

统一使用 `GET /api/listing/agent/package`。用 `q` 查找库存实物副本，用返回的 `id` 下载单件 ZIP。

```http
GET /api/listing/agent/package?by=catalogNumber&q=WPCR-0001
GET /api/listing/agent/package?id=0123456789abcdef0123456789abcdef
```

- 查找时可用 `by=text`（默认，匹配艺人与专辑名）、`by=barcode` 或 `by=catalogNumber`（归一化后精确匹配）。结果仅含国内和海外库存。多副本命中时应先选定一件，再下载资料。
- 查找响应是 `application/json`。每页最多 20 项，`copies` 含候选，`nextOffset` 可作为下一次请求的 `offset`，末页为 `null`。每个候选含 `id`、`title`、`artist`、`catalogNumber`、`barcode`、`version`、`pressing`、`obi`、`status` 和 `listed`。
- 下载响应是 `application/zip`。根目录有 UTF-8 编码的 `materials.json`，`photos/01.jpg` 等文件按打包顺序编号，扩展名沿用原文件。包内有且仅有清单和清单列出的原图。单图上限 6 MiB，图片合计上限 35 MiB。
- 优先沿用照片版本相同的历史选图与顺序。其余副本按当前顺序打包所有原图。若只取资料，传 `photos=0`，ZIP 仅含清单。选取部分照片或调整顺序时传 `order=0,2` 与清单当前的 `photoRevision`。序号从 0 开始且不能重复。版本冲突返回 409，重新取包并核对。
- `id` 与查询参数 `q`、`by`、`offset` 不能混用。启用接口后缺少有效令牌返回 401。令牌文件不存在返回 404。参数无效、目标离开库存、二手交易关闭或原图缺失返回 400。错误响应为包含 `error` 的 JSON。

### ZIP 清单

| 字段 | 含义 |
| --- | --- |
| `id`、`revision` | 唯一实物副本 ID 及记录版本。回填上架回执用当前记录版本。 |
| `photoRevision`、`photoCount` | 照片版本及副本照片总数。 |
| `photoOrder`、`photos` | 本包的 0 基序号数组及有序文件清单 `[{index,file}]`。包内首张可用作首图。没有图或用了 `photos=0` 时两个数组为空。 |
| `listed` | Obi 当前的上架标记。平台是否在线由外部系统核实。 |
| `facts` | `album`、`release`、`copy` 三组白名单资料。发行版资料属于版次，本副本照片和确认过的实物信息才可作为品相依据。 |

资料包排除采购成本、购买渠道、私人备注、凭据和其他副本数据。文案由外部系统持久化。旧的 `/api/listing/agent/copies`、`materials`、`photos` 和 `draft` 接口已停用。

## 闲鱼交易同步

外部系统负责上架、核对在线状态及跟踪订单。Obi 接收已核实的事实，并应用账本里的上架、售出和确认收货事务。见 D-046。

### 单独启用

下文三个写入口需要 `trading:write` 权限。无人值守的订单监听器单独签发一枚只有 `trading:write` 的令牌，出问题时单独撤销，不影响上架 Agent。旧方式 `credentials/trading-agent.token`（`obi_trading_` 前缀，重启后生效）仍按 `trading:write` 识别。每个请求使用 `Authorization: Bearer <令牌>`，远程使用既有 HTTPS 地址。`listing:read` 只读，`trading:write` 只用于本节的三个写入口。

交易同步也要求开启「二手交易」。错误返回 `{"error":"…"}`。没有调用方具有 `trading:write` 时返回 404，令牌无效返回 401，令牌缺少该权限返回 403，字段无效或模块关闭返回 400。遇到副本版本、商品绑定、订单或到账日期冲突时返回 409，由调用方保留事实供核对。

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
- 库存按上架时间排序时，闲鱼回执使用 `verifiedAt`，手动标记使用 Obi 的审计时间。

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

在仓库根运行 `python3 -m unittest discover -s tests -p test_listing_routes.py` 和 `python3 -m unittest discover -s tests -p test_trading_agent.py`。测试在临时数据目录用 Obi 固定样本和本机 HTTP 验证资料包、回执、售出及结算，并覆盖事实乱序、并发重复订单、历史链接、旧销售单和令牌隔离。测试数据中的商品号、订单号和金额均为虚构值。
