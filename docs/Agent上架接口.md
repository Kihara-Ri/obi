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
