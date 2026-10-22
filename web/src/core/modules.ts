// 模块目录只包含静态能力与依赖；用户选择经 AppContext 从服务端读取。
import type {ModuleFlags, StartPage, Status} from '../types';

export type ModuleIconKey = 'disc' | 'grid' | 'receipt' | 'tag' | 'plane' | 'list' | 'box' | 'more' | 'yen' | 'truck' | 'chart';

export const MODULES = [
  {id: 'showcase', icon: 'grid', name: '收藏展示', desc: '九种封面排列与逐张展示，可选择自己的展示首页。'},
  {id: 'acquisition', icon: 'receipt', name: '购入记录', desc: '记录购买时间、店铺、原币金额与成本。'},
  {id: 'trading', icon: 'tag', name: '二手交易', desc: '管理上架、成交、待到账与交易历史。'},
  {id: 'circulation', icon: 'plane', name: '海外周转', desc: '管理海外库存、运输包裹与运费分摊；包含购入记录。'},
] as const;

export const PRESETS: ReadonlyArray<{id: string; icon: ModuleIconKey; name: string; desc: string; who: string; enabled: ModuleFlags}> = [
  {id: 'collection', icon: 'disc', who: '只想把家里的 CD 登记清楚、随时查得到', name: '整理收藏', desc: '整理专辑、版本、实物照片和存放位置。', enabled: {acquisition: false, trading: false, circulation: false, showcase: false}},
  {id: 'appreciation', icon: 'grid', who: '想翻着封面欣赏，像逛自己的唱片墙', name: '展示收藏', desc: '展示封面、翻阅收藏；购入与交易资料按需开启。', enabled: {acquisition: false, trading: false, circulation: false, showcase: true}},
  {id: 'provenance', icon: 'receipt', who: '想记下每张的买入价、日期和渠道', name: '收藏与购入', desc: '记住每张专辑什么时候、在哪里买的。', enabled: {acquisition: true, trading: false, circulation: false, showcase: false}},
  {id: 'selling', icon: 'tag', who: '收藏之外会出手二手，要上架、成交和算利润', name: '收藏与交易', desc: '收藏之余，偶尔上架和出售二手专辑。', enabled: {acquisition: true, trading: true, circulation: false, showcase: false}},
  {id: 'overseas', icon: 'plane', who: '从日本等地代购，要追踪海外库存和国际运费', name: '海外周转', desc: '保留海外买入、运回、销售与完整账目。', enabled: {acquisition: true, trading: true, circulation: true, showcase: false}},
];

// 未配置的旧实例维持原有能力；新增的展示模块由用户主动开启。
export const LEGACY_MODULES: ModuleFlags = {acquisition: true, trading: true, circulation: true, showcase: false};

export function normalizeModules(enabled: ModuleFlags): ModuleFlags {
  return {...enabled, showcase: enabled.showcase === true};
}

export function homePage(startPage: StartPage | undefined, modules: ModuleFlags): StartPage {
  return startPage === 'gallery' && modules.showcase ? 'gallery' : 'domestic';
}

export function sameModules(a: ModuleFlags, b: ModuleFlags): boolean {
  return MODULES.every(m => a[m.id] === b[m.id]);
}

export function pageEnabled(page: string, m: ModuleFlags): boolean {
  if (page === 'gallery') return m.showcase;
  if (['overseas', 'transit'].includes(page)) return m.circulation;
  if (['shipping', 'trades'].includes(page)) return m.trading;
  if (page === 'stats') return m.acquisition || m.trading;
  return ['domestic', 'settings', 'trash', 'more', 'lookup'].includes(page);
}

export function statusName(status: Status, m: ModuleFlags): string {
  if (!m.circulation && ['overseas', 'domestic'].includes(status)) return '收藏中';
  return {overseas: '海外库存', transit: '海外在途', domestic: '国内库存', shipping: '售出中', sold: '已售出', trash: '回收站'}[status];
}

export function onShelf(status: Status, page: string, m: ModuleFlags): boolean {
  return page === 'domestic' && !m.circulation
    ? ['overseas', 'domestic', 'transit'].includes(status) : status === page;
}

// 界面变化预览（迷你手机 ModulePhone + 完整清单 ModuleImpact）的数据：每一处受模块影响的界面位置，以及它在什么配置下出现。
// 与 components/AppNav.tsx 的 NAV / MOBILE_TABS、各表单实际的 modules 判断保持一致；改了那边也要改这里。
export interface Surface {id: string; icon?: ModuleIconKey; label: string | ((m: ModuleFlags) => string); show: (m: ModuleFlags, home: StartPage) => boolean}
export interface SurfaceGroup {id: string; title: string; hint: string; items: Surface[]}

export const SURFACE_GROUPS: SurfaceGroup[] = [
  {id: 'mobile', title: '手机底栏', hint: '屏幕下方的标签', items: [
    {id: 'm-gallery', icon: 'grid', label: '展示', show: (m, h) => m.showcase && homePage(h, m) === 'gallery'},
    {id: 'm-stock', icon: 'list', label: m => m.circulation ? '库存' : '收藏', show: () => true},
    {id: 'm-transit', icon: 'plane', label: '在途', show: m => m.circulation},
    {id: 'm-shipping', icon: 'box', label: '售出中', show: m => m.trading},
    {id: 'm-more', icon: 'more', label: '更多', show: () => true},
  ]},
  {id: 'side', title: '桌面侧栏', hint: '左侧导航', items: [
    {id: 's-gallery', label: '收藏展示', show: m => m.showcase},
    {id: 's-overseas', label: '海外库存', show: m => m.circulation},
    {id: 's-transit', label: '海外在途', show: m => m.circulation},
    {id: 's-domestic', label: m => m.circulation ? '国内库存' : '我的收藏', show: () => true},
    {id: 's-shipping', label: '售出中', show: m => m.trading},
    {id: 's-trades', label: '交易记录', show: m => m.trading},
    {id: 's-stats', label: '账本', show: m => m.acquisition || m.trading},
  ]},
  {id: 'form', title: '添加专辑', hint: '录入表单里的内容', items: [
    {id: 'f-buy', label: '买入金额与日期', show: m => m.acquisition},
    {id: 'f-shop', label: '购买渠道', show: m => m.acquisition},
    {id: 'f-where', label: '入库位置：海外 / 国内', show: m => m.circulation},
  ]},
  {id: 'detail', title: '专辑详情 · 管理', hint: '点开一张专辑后', items: [
    {id: 'd-buy', icon: 'yen', label: '买入信息与成本', show: m => m.acquisition},
    {id: 'd-list', icon: 'tag', label: '上架与售卖草稿', show: m => m.trading},
    {id: 'd-ship', icon: 'truck', label: '运输与运费分摊', show: m => m.circulation},
    {id: 'd-sales', icon: 'chart', label: '交易历史与利润', show: m => m.trading},
  ]},
  {id: 'bulk', title: '库存页操作', hint: '勾选专辑后的批量按钮', items: [
    {id: 'b-sell', label: '合单售出 · 标记上架', show: m => m.trading},
    {id: 'b-ship', label: '打包运输', show: m => m.circulation},
    {id: 'b-back', label: '调回海外', show: m => m.circulation},
  ]},
];
