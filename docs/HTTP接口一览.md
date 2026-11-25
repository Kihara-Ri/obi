# Obi HTTP 接口一览

本页列出服务器版的 HTTP 路由。已授权的外部客户端可使用有独立契约的接口。应用与管理路由使用 `album_session` 登录会话。服务器对请求的 Host 和 Origin 仍做正常校验。表中的「读」指读取业务数据，标有缓存的路径可以更新服务端缓存。按任务串起调用顺序见[接口场景指南](接口场景指南.md)。介绍站「接口」页的路由数据（`site/src/lib/api-http.ts`、`site/src/lib/api-app.ts`）照本页逐条列出，路由增减时一并改。

## 对外接口

| 方法 | 路径 | 授权 | 读写 | 用途 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 免登录 | 读 | 服务是否正常、构建版本、账本结构版本和运行时长。 |
| GET | `/api/collection/purchases` | `collection:read` | 读 | 按艺人、专辑、编号或条码查找有购买依据的副本和已录入的发行资料，覆盖持有、在途及交易历史。 [请求与 curl 示例](已购唱片查询接口.md) |
| GET | `/api/listing/agent/package` | `listing:read`，且启用二手交易 | 读 | 查国内、海外库存。按副本打包发行资料和有序原图，可只取清单。 [资料包契约](Agent上架接口.md#查找与下载) |
| POST | `/api/listing/agent/receipts` | `trading:write`，且启用二手交易 | 写 | 登记已核实在线的闲鱼商品，关联副本并更新上架状态。 |
| POST | `/api/trading/agent/orders` | `trading:write`，且启用二手交易 | 写 | 记录已付款的闲鱼订单，使关联副本进入售出中。 |
| POST | `/api/trading/agent/settlements` | `trading:write`，且启用二手交易 | 写 | 回报买家收货与实际到账，两项齐备后按到账日期入账。 [交易同步契约](Agent上架接口.md#闲鱼交易同步) |
| GET | `/api/insight/profile` | `insight:read` | 读 | 近期加权的买卖画像：成本模型（汇率、按介质的国际运费与整批费用、平台扣费）、周转天数、利润排行。 [采购评估契约](采购评估接口.md) |
| POST | `/api/insight/evaluate` | `insight:read` | 读 | 一次评估 1–50 条网站候选：是否已有、同版本或同专辑的历史成本与净收入、落地成本和预计利润。不保存候选。 |
| GET | `/api/insight/releases` | `insight:read` | 读 | 按单个候选的字段查询，返回内容同 `evaluate` 的一条。 |
| POST | `/mcp` | 任一权限的调用方令牌 | 按工具 | MCP 入口：按令牌权限列出对应上面接口的工具和场景模板。`GET /mcp` 返回 405。 [MCP 接入](MCP接入.md) |
| GET | `/api/mcp/package` | 链接内签名（10 分钟） | 读 | 下载 `get_listing_package` 对应版本的 ZIP，副本或照片版本变化时返回 409。 |

授权列是调用方令牌需要的权限。管理员在「设置 → 高级 → MCP 服务」或用 `python3 -m server.client_admin` 签发带权限的令牌，见[对外令牌](对外令牌.md)。旧令牌按固定权限识别。客户端通过 HTTPS 的 `Authorization: Bearer` 请求头认证。

## 账户与实例管理

| 方法 | 路径 | 授权 | 读写 | 用途 |
| --- | --- | --- | --- | --- |
| POST | `/api/setup` | 私有安装凭据 | 写认证 | 仅全新公网实例可用。提交 `token` 获取设置密钥，再提交 `token` 与 6 位 `code` 完成绑定。 |
| POST | `/api/login` | Google Authenticator 动态码 | 写会话 | 提交字符串 `code`（6 位数字），成功后返回会话 Cookie；尝试过多时返回 429。 |
| POST | `/api/logout` | 登录会话 | 写会话 | 注销当前会话。 |
| GET | `/api/clients` | 服务器版登录会话 | 读 | 列出 MCP 地址、调用方名称、权限和签发时间。 |
| POST | `/api/clients/issue`、`/api/clients/rotate`、`/api/clients/scopes`、`/api/clients/revoke` | 服务器版登录会话 | 写凭据 | 签发、轮换、改权限或撤销。仅签发和轮换响应返回明文令牌。 |
| GET | `/api/backup` | 登录会话 | 读 | 下载包含账本和业务资产的完整 ZIP。 |
| GET | `/api/export` | 登录会话 | 读 | 导出专辑 CSV，`scope=sales` 时导出交易 CSV。 |
| POST | `/api/restore` | 登录会话 | 写账本 | 从 JSON 恢复账本。 |
| POST | `/api/restore-archive` | 登录会话 | 写账本和业务资产 | 从 ZIP 恢复完整备份。 |
| POST | `/api/modules` | 登录会话 | 写设置 | 保存购入、二手交易、海外周转、收藏展示开关和起始页。 |
| GET | `/api/plugins/album-engine` | 登录会话 | 读 | 查看插件可用版本、安装状态和任务状态。 |
| POST | `/api/plugins/album-engine/install` | 登录会话 | 写插件状态和文件 | 安装随版本提供的 Album Engine。 |
| POST | `/api/plugins/album-engine/uninstall` | 登录会话 | 写插件状态和文件 | 卸载 Album Engine，忙任务拒绝。 |

## 应用内部接口

下表每项都需要登录会话。App 用这些接口完成界面操作，部分能力取决于启用的模块、已安装的插件或外部资料源。

| 方法 | 路径 | 读写 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/state` | 读 | 读取应用的账本状态及派生成本、交易和包裹。 |
| GET | `/api/album-favorites` | 读 | 读取专辑的喜欢状态。 |
| POST | `/api/album-favorites` | 写 | 设置喜欢状态。 |
| POST | `/api/records`、`/api/records/metadata` | 写 | 新增或更新副本。`metadata` 只编辑发行、包装和照片等资料；黑胶副本可带 `vinyl`（尺寸、转速、彩胶、品相，见 D-055），传 `null` 清空。 |
| POST | `/api/bulk`、`/api/listing/details` | 写 | 批量流转、移除和恢复副本，标记上架或编辑上架平台和链接。 |
| POST | `/api/sales`、`/api/sale-action`、`/api/sale-update` | 写 | 登记销售单，以及确认收货、撤销、退款、退货和修正费用。 |
| POST | `/api/shipments`、`/api/shipment-action`、`/api/shipment-update` | 写 | 建立包裹、确认签收或撤销、修改运费与包裹明细。 |
| POST | `/api/showcase/groups` | 写 | 新建、编辑或删除收藏展示分组。 |
| GET | `/api/photo/{记录id}/{序号}`、`/api/photos/archive` | 读 | 读单张实物照片，或按副本、照片顺序与版本下载原图 ZIP。 |
| POST | `/api/photos/stage` | 写暂存文件 | 暂存上传的照片，供副本保存时采用。 |
| GET | `/api/cover/{内容哈希}.{扩展名}` | 读 | 按内容哈希读取已保存的封面图。 |
| POST | `/api/covers/search`、`/api/covers/fallback` | 读和缓存 | 搜索封面或按版本和专辑查找备用封面。`fallback` 可带 `medium`，借同专辑封面时优先同介质版本。 |
| POST | `/api/covers/download` | 读，可缓存封面 | 下载已选封面，`stash: true` 时保存封面文件。 |
| POST | `/api/catalog/barcode`、`/api/catalog/barcode/verify`、`/api/catalog/number` | 读和缓存 | 精确查找条码或唱片编号，核对选择的发行版是否对应条码。查找可带 `medium`（`auto` 跨介质，或 `cd` / `vinyl` / `other`，缺省 `cd`），见 D-053。 |
| POST | `/api/catalog/search`、`/api/catalog/versions` | 读和缓存 | 从公开目录查找专辑及其发行版本。`versions` 可带 `medium`，`auto` 查各介质，缺省只列 CD 版本。 |
| GET | `/api/release-details` | 读和缓存 | 读取指定发行版的元数据与曲目资料。带 `medium` 时核对这一版有该介质。 |
| GET | `/api/catalog/front-cover` | 读，可缓存封面 | 查已确认版本的正面封面，`stash=1` 时保存封面文件。 |
| GET | `/api/artists/profile`、`/api/artists/catalog` | 读和缓存 | 读取艺人面板、收藏摘要及作品目录。 |
| GET | `/api/artists/artwork/{作品编号}` | 读和缓存 | 读取本地作品目录中已有条目的代表图。 |
| POST | `/api/artists/resolve` | 读，可写身份绑定 | 根据发行署名或作品证据解析艺人身份，可持久化已确认绑定。 |
| POST | `/api/artists/bind`、`/api/artists/work-link`、`/api/artists/work-unlink` | 写 | 手动绑定艺人身份，确认或解除副本与作品的关联。 |
| GET | `/api/rate` | 读和缓存 | 取指定日期的参考汇率，需要时补取。 |
| POST | `/api/rates/prepare` | 写汇率缓存 | 批量准备参考报价。 |
| GET | `/api/shop-brands`、`/api/shop-brand-icon/{图标编号}` | 读 | 读购买渠道图标和图标服务状态。 |
| POST | `/api/shops/retry` | 写任务和缓存 | 重试发现已登记购买渠道的图标，需要服务器上的 Pi 配置。 |
| GET | `/api/twins` | 读 | 查看数字实体索引和引擎状态。 |
| GET | `/api/plugins/album-engine/assets/{版本}/{路径}` | 读 | 读取已安装 Album Engine 清单内的浏览器文件和模型。 |
| GET | `/api/twin-model-assets/{任务编号}/{文件}`、`/api/twin-assets/{任务编号}/{文件}`、`/api/twin-review-assets/{任务编号}/{文件}` | 读 | 读取已发布模型、实物资产或核对用资产。 |
| GET | `/api/twin-source-preview/{任务编号}/{图片序号}` | 读 | 预览插件任务可选的来源图。 |
| POST | `/api/twins/accessories`、`/api/twins/disc-calibration` | 写 | 保存数字实体配件和盘面校准，需要安装 Album Engine。 |

## 实例开关与已退役入口

- Album Engine 管理接口可显示未安装状态。已安装并通过清单校验后才提供插件文件和运行能力。插件卸载后仍保有旧数字实体的资料。 [插件契约](AlbumEngine插件.md)
- 上架和交易同步端点另需开启二手交易；已购查询和采购评估与账本模块开关无关。没有任何调用方具有所需权限时返回 404，缺少或令牌无效返回 401，令牌有效但缺少该权限返回 403。
- 旧版上架 `copies`、`materials`、`photos`、`draft` 路由及内置售卖草稿与模型入口已退役。D-047 以资料包和交易回执接替它们。 [上架接口](Agent上架接口.md)
- 具体实例的凭据、模块和插件状态以已部署版本与实例配置为准。公开介绍站、登录页和 PWA 壳是页面或静态资源。

路由和访问方式由 [路由表](../server/routes.py) 与 [HTTP 请求分发](../server/http.py) 定义。
