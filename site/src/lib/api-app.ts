// 「接口」页 B 面：应用内部接口，按功能分组。默认凭据为登录会话（album_session）。
// 与 server/routes.py 的 GET / GET_PREFIX / POST / UPLOAD 表逐项对应；路由增删时同步这里与 docs/HTTP接口一览.md。
import type { Group } from './api-http';

const bulk = '/api/bulk';

export const app: Group[] = [
  {
    id: 'app-collection', title: '收藏',
    routes: [
      { m: 'GET', p: '/api/state', does: '整本账：副本、专辑、销售、包裹与派生成本。', ret: '账本 · service（login、version、backup）；ETag 未变 304' },
      { m: 'POST', p: '/api/records', does: '新增或更新副本；带 id 为更新。条码或版本改了会先联网核对。',
        body: '单个副本，或 items*（1–500）· batchFees · allocation（price 按金额分摊）', ret: 'ids' },
      { m: 'POST', p: '/api/records/metadata', does: '只改发行、包装与照片资料，不动金额。', body: '同上', ret: 'ids' },
      { m: 'POST', p: bulk, does: '批量移除与恢复副本（交易、周转的动作也走这里）。', body: 'ids* · action*（delete · restore）', ret: 'count' },
      { m: 'GET', p: '/api/album-favorites', does: '专辑的喜欢状态。', ret: 'albums · recordAlbumIds' },
      { m: 'POST', p: '/api/album-favorites', does: '设置喜欢。', body: 'recordId* · liked*' },
    ],
  },
  {
    id: 'app-catalog', title: '发行资料', lead: '录入时查版本：只做精确匹配，不按标题猜。',
    routes: [
      { m: 'POST', p: '/api/catalog/barcode', does: '条码精确查找，MusicBrainz / Discogs / Deezer / iTunes 并发，20 秒内答复；查黑胶时只问 MusicBrainz / Discogs。', body: 'barcode* · medium（cd / vinyl / other，缺省 cd）', ret: 'barcode · candidates[] · sources' },
      { m: 'POST', p: '/api/catalog/barcode/verify', does: '核对条码是否属于所选发行版。', body: 'barcode* · releaseId*', ret: 'barcode · releaseId · valid' },
      { m: 'POST', p: '/api/catalog/number', does: '唱片编号精确查找（MusicBrainz / Discogs / NDL）。', body: 'catalogNumber*（2–80 字） · medium', ret: 'catalogNumber · candidates[] · sources' },
      { m: 'POST', p: '/api/catalog/search', does: '文字搜索，按专辑去重。', body: 'text*（≤120 字）', ret: 'text · albums[] · sources' },
      { m: 'POST', p: '/api/catalog/versions', does: '展开一张专辑的版本，按介质过滤（缺省 CD）。', body: 'id* · title · artist · medium', ret: 'candidates[]' },
      { m: 'GET', p: '/api/release-details', does: '发行版的元数据与曲目；带 medium 时核对这一版有该介质。', q: 'id* · medium', ret: 'releaseInfo' },
      { m: 'GET', p: '/api/catalog/front-cover', does: '已确认 MusicBrainz 版本的正面封面。', q: 'id* · stash=1（落盘只回引用）', ret: 'cover；无正面图时 reason: no-front' },
    ],
  },
  {
    id: 'app-covers', title: '封面',
    routes: [
      { m: 'POST', p: '/api/covers/search', does: '搜索封面候选。', body: 'title · artist · country（默认 AUTO）· releaseId' },
      { m: 'POST', p: '/api/covers/fallback', does: '版本没有封面时的退路：同专辑封面 → iTunes 数字封面。', body: 'title · artist · releaseId · medium', ret: 'candidate' },
      { m: 'POST', p: '/api/covers/download', does: '下载选中的封面。', body: 'token* · stash（true 落盘只回引用）', ret: 'cover' },
      { m: 'GET', p: '/api/cover/{哈希}.{jpg|png|webp}', does: '按内容哈希读已存封面，长缓存。' },
    ],
  },
  {
    id: 'app-artists', title: '艺人',
    routes: [
      { m: 'GET', p: '/api/artists/profile', does: '艺人面板与收藏摘要。', q: 'artist* · refresh=1' },
      { m: 'GET', p: '/api/artists/catalog', does: '作品目录，分页。', q: 'artist* · offset · refresh=1 · roundId' },
      { m: 'GET', p: '/api/artists/artwork/{作品 id}', does: '目录里作品的代表图；无图 404。' },
      { m: 'POST', p: '/api/artists/resolve', does: '按署名解析艺人身份。', body: 'artist* · searchName · force' },
      { m: 'POST', p: '/api/artists/bind', does: '手动绑定艺人身份。', body: 'artist* · artistMbid · expectedArtistMbid', ret: 'ok · binding' },
      { m: 'POST', p: '/api/artists/work-link', does: '确认副本属于哪部作品。',
        body: 'artist* · recordId* · releaseGroupMbid · expectedReleaseGroupMbid · recordArtist · recordTitle', ret: 'ok · link' },
      { m: 'POST', p: '/api/artists/work-unlink', does: '解除副本与作品的关联。', body: 'recordId* · expectedReleaseGroupMbid' },
    ],
  },
  {
    id: 'app-acquisition', title: '购入', lead: '汇率与购买渠道。',
    routes: [
      { m: 'GET', p: '/api/rate', does: '某天的日元参考汇率，需要时补取。', q: 'date', ret: 'date · rate · status' },
      { m: 'POST', p: '/api/rates/prepare', does: '批量准备报价。', body: 'dates*（≤500）', ret: 'quotes[] · status' },
      { m: 'GET', p: '/api/shop-brands', does: '购买渠道图标与图标服务状态。', ret: 'brands · provider' },
      { m: 'GET', p: '/api/shop-brand-icon/{名称}', does: '渠道图标 PNG。' },
      { m: 'POST', p: '/api/shops/retry', does: '重试发现已保存渠道的图标（需服务器上的 Pi）。', body: 'name*', ret: 'queued' },
    ],
  },
  {
    id: 'app-trading', title: '交易', lead: '需开启二手交易。',
    routes: [
      { m: 'POST', p: bulk, does: '标记上架、下架。', body: 'ids* · action*（list + listing · unlist）', ret: 'count' },
      { m: 'POST', p: '/api/listing/details', does: '标记上架或编辑上架平台与链接。', body: 'mode*（list · edit）· entries*（id · revision · channel · url）', ret: 'count' },
      { m: 'POST', p: '/api/sales', does: '登记销售单，进入售出中。',
        body: 'ids* · gross* · date* · fees · postage · currency（CNY · JPY）· channel（默认闲鱼）· orderId · address · note', ret: 'id' },
      { m: 'POST', p: '/api/sale-action', does: '确认收货、撤销、退款、撤回退款、记寄回运费。',
        body: 'id* · action*（receive · cancel · refund · undo_refund · return_postage）· date · refund · returned · unshipped · returnPostage' },
      { m: 'POST', p: '/api/sale-update', does: '补录或修正费用，不改成交价与到账。', body: 'id* · fees · postage' },
    ],
  },
  {
    id: 'app-circulation', title: '海外周转', lead: '需开启海外周转（同时要购入）。',
    routes: [
      { m: 'POST', p: bulk, does: '副本转海外、转国内及撤回。', body: 'ids* · action*（to_overseas · undo_to_overseas · to_domestic · undo_to_domestic）', ret: 'count' },
      { m: 'POST', p: '/api/shipments', does: '建立包裹，运费按副本分摊，副本进入在途。', body: 'ids* · date* · cost · currency · method · note', ret: 'id' },
      { m: 'POST', p: '/api/shipment-action', does: '签收、撤销签收或撤销包裹。', body: 'id* · action*（arrive · undo_arrive · cancel）· date' },
      { m: 'POST', p: '/api/shipment-update', does: '改运费、方式、日期与包裹明细。', body: 'id* · cost · currency · method · date · note · add[] · remove[]' },
    ],
  },
  {
    id: 'app-showcase', title: '展示', lead: '需开启收藏展示。',
    routes: [
      { m: 'POST', p: '/api/showcase/groups', does: '新建、编辑或删除展示分组。', body: 'action*（create · update · delete）· expectedRevision* · id · name · recordIds' },
      { m: 'GET', p: '/api/twins', does: '数字实体索引与引擎状态。', ret: 'epoch · revision · jobs' },
      { m: 'POST', p: '/api/twins/accessories', does: '保存数字实体的配件资料。' },
      { m: 'POST', p: '/api/twins/disc-calibration', does: '保存盘面校准，需安装 Album Engine。' },
      { m: 'GET', p: '/api/twin-assets/{任务}/{文件}', does: '已发布数字实体的贴图等资产。' },
      { m: 'GET', p: '/api/twin-model-assets/{任务}/{文件}', does: '已发布的 3D 模型文件。' },
      { m: 'GET', p: '/api/twin-review-assets/{任务}/{文件}', does: '核对用的发行资料预览。' },
      { m: 'GET', p: '/api/twin-source-preview/{任务}/{序号}', does: '插件任务可选的来源图。', q: 'source' },
    ],
  },
  {
    id: 'app-photos', title: '照片',
    routes: [
      { m: 'GET', p: '/api/photo/{副本 id}/{序号}', does: '单张实物照片。', q: 'photoRevision（带上可长缓存，版本不符 400）' },
      { m: 'GET', p: '/api/photos/archive', does: '按选定顺序下载原图 ZIP。', q: 'id* · photoRevision* · order' },
      { m: 'POST', p: '/api/photos/stage', does: '暂存一张照片，保存副本时引用。请求体是图片本身（octet-stream，≤8 MB）。', q: 'token*' },
    ],
  },
  {
    id: 'app-system', title: '设置与系统',
    routes: [
      { m: 'POST', p: '/api/login', auth: '实例密码', does: '登录，下发 album_session Cookie。', body: 'password*' },
      { m: 'POST', p: '/api/logout', does: '注销当前会话。' },
      { m: 'POST', p: '/api/password', does: '改密码，其他设备全部退出。', body: 'current* · next*' },
      { m: 'GET', p: '/api/clients', does: '调用方列表：名称、权限、签发时间。', ret: 'available · path · scopes · clients[] · legacy' },
      { m: 'POST', p: '/api/clients/issue', does: '签发令牌，明文只在这次响应里出现。', body: 'name* · scopes*', ret: 'token · 列表' },
      { m: 'POST', p: '/api/clients/rotate', does: '换新令牌，旧的立即失效。', body: 'name*', ret: 'token · 列表' },
      { m: 'POST', p: '/api/clients/scopes', does: '改调用方权限。', body: 'name* · scopes*' },
      { m: 'POST', p: '/api/clients/revoke', does: '撤销调用方。', body: 'name*' },
      { m: 'POST', p: '/api/modules', does: '模块开关与起始页。', body: 'enabled*（acquisition · trading · circulation · showcase）· startPage（domestic · gallery）', ret: 'ok · enabled · startPage' },
      { m: 'GET', p: '/api/plugins/album-engine', does: 'Album Engine 可用版本、安装与任务状态。' },
      { m: 'POST', p: '/api/plugins/album-engine/install', does: '安装随版本提供的插件。', body: 'expectedRevision' },
      { m: 'POST', p: '/api/plugins/album-engine/uninstall', does: '卸载插件，不删实体与贴图；忙时拒绝。', body: 'expectedRevision' },
      { m: 'GET', p: '/api/plugins/album-engine/assets/{版本}/{路径}', does: '插件清单内的浏览器文件与模型。' },
      { m: 'GET', p: '/api/backup', does: '完整备份 ZIP：账本 + 照片、封面、实体文件。' },
      { m: 'GET', p: '/api/export', does: '导出专辑 CSV。', q: 'scope=sales（导出交易）' },
      { m: 'POST', p: '/api/restore', does: '从 JSON 备份恢复账本。' },
      { m: 'POST', p: '/api/restore-archive', does: '从 ZIP 恢复完整备份。请求体是 ZIP 本身（≤4 GB）。' },
    ],
  },
];
