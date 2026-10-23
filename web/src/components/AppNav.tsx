// 应用导航：桌面侧栏（Sidebar）与手机底栏（MobileNav），以及两处共用的各页数量（navCounts）。
// 入口按模块开关过滤；未开启「流转」时国内库存改叫「我的收藏 / 收藏」，海外与在途并入它的数量。
import type {AppState, ModuleFlags} from '../types';
import {pageEnabled} from '../core/modules';
import {Ledger} from './PageHead';
import {InstallNavItem} from './InstallNavItem';
import {GearIcon} from './ui/GearIcon';
import {NavIcon} from './navIcons';
import {isLocalSite} from '../core/backend';

const NAV = [
  {hash: 'gallery', ico: '▦', label: '收藏展示'},
  {hash: 'overseas', ico: '◧', label: '海外库存'},
  {hash: 'transit', ico: '✈', label: '海外在途'},
  {hash: 'domestic', ico: '▤', label: '国内库存'},
  {hash: 'shipping', ico: '◨', label: '售出中'},
  {hash: 'trades', ico: '↗', label: '交易记录'},
  {hash: 'stats', ico: '◷', label: '账本'},
  {hash: 'lookup', ico: '⌕', label: '查询'},
];

// 手机把国内 / 海外收进库存页；低频入口通过独立「更多」页访问。
const MOBILE_TABS = [
  {hash: 'domestic', ico: '▤', label: '库存', count: 'inventory'},
  {hash: 'transit', ico: '✈', label: '在途', count: 'transit'},
  {hash: 'shipping', ico: '◨', label: '售出中', count: 'shipping'},
] as const;
// 以展示为主的用户（默认首页是收藏展示）：「展示」是底栏第一个标签；
// 以管理为主的用户不占标签，改用库存页 / 展示页顶栏的「库存｜展示」切换（ShowcaseSwitch）。
const GALLERY_TAB = {hash: 'gallery', ico: '▦', label: '展示', count: ''} as const;

const ACTIVE_WEIGHT = 2.3;
const MORE_HASHES = new Set(['more', 'lookup', 'trades', 'stats', 'settings', 'trash']);

export function navCounts(state: AppState, modules: ModuleFlags): Record<string, number> {
  const counts: Record<string, number> = {
    overseas: 0, transit: 0, domestic: 0, shipping: 0, trades: 0,
  };
  state.records.forEach(r => { if (r.status in counts) counts[r.status]++; });
  counts.trades = state.sales.filter(s => s.status === 'complete').length;
  if (!modules.circulation) counts.domestic += counts.overseas + counts.transit;
  counts.inventory = counts.domestic + (modules.circulation ? counts.overseas : 0);
  return counts;
}

interface SidebarProps {
  page: string; home: string; modules: ModuleFlags; counts: Record<string, number>;
  installEvt: Event | null; onInstalled: () => void;
}

export function Sidebar({page, home, modules, counts, installEvt, onInstalled}: SidebarProps) {
  const nav = NAV.filter(n => pageEnabled(n.hash, modules)).map(n => ({...n,
    label: n.hash === 'domestic' && !modules.circulation ? '我的收藏' : n.label,
  }));
  return (
    <aside className="sidebar">
      <a className="brand" href={`#${home}`}>
        <img className="brand-logo" src="/icon-192.png" alt="" width="30" height="30"/>
        <span>Obi</span>
      </a>
      <nav aria-label="主导航">
        {nav.map(n => (
          <a key={n.hash} href={`#${n.hash}`} data-nav={n.hash}
             className={page === n.hash ? 'active' : ''}
             aria-current={page === n.hash ? 'page' : 'false'}>
            <span className="nav-ico">{n.ico}</span>{n.label}
            {counts[n.hash] !== undefined && n.hash !== 'stats' ? <b id={`${n.hash}-count`}>{counts[n.hash]}</b> : null}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {installEvt ? <InstallNavItem evt={installEvt} onInstalled={onInstalled}/> : null}
        <Ledger/>
        <a href="#settings" data-nav="settings"
           className={page === 'settings' ? 'active' : ''}>
          <span className="nav-ico" aria-hidden="true"><GearIcon size={14}/></span>设置与备份
        </a>
        <div className="local-note"><i/> {isLocalSite() ? '数据只保存在这台设备上' : '数据保存在服务设备'}</div>
      </div>
    </aside>
  );
}

interface MobileNavProps {
  page: string; modules: ModuleFlags; counts: Record<string, number>;
  showcaseTab: boolean; inventoryPage: string;
}

export function MobileNav({page, modules, counts, showcaseTab, inventoryPage}: MobileNavProps) {
  const mobileTabs = [...(showcaseTab ? [GALLERY_TAB] : []), ...MOBILE_TABS].filter(n => pageEnabled(n.hash, modules)).map(n => ({...n,
    label: n.hash === 'domestic' && !modules.circulation ? '收藏' : n.label,
  }));
  // 库存标签同时代表海外库存；以管理为主时，展示页也算库存标签下的页面
  const tabActive = (hash: string) => page === hash
    || (hash === 'domestic' && (page === 'overseas' || (page === 'gallery' && !showcaseTab)));
  // 底栏：激活的标签展开成「图标 + 文字」胶囊，其余只留图标；胶囊随激活槽位滑动并变宽。
  // 槽位按权重分宽（激活 2.4、其余 1）；导航列宽与胶囊位置用同一套权重、同一过渡，二者始终对齐。
  const activeTab = mobileTabs.findIndex(t => tabActive(t.hash));
  const slots = mobileTabs.length + 1;
  const pillIndex = activeTab >= 0 ? activeTab : mobileTabs.length;
  const weights = Array.from({length: slots}, (_, i) => i === pillIndex ? ACTIVE_WEIGHT : 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const before = weights.slice(0, pillIndex).reduce((a, b) => a + b, 0);
  return (
    <nav className="mobile-nav" aria-label="手机导航" style={{gridTemplateColumns: weights.map(w => w + 'fr').join(' ')}}>
      {/* 胶囊宽度恒为激活权重占比，只在槽位间平移：用 transform（合成器线程），换页渲染占满主线程时也不掉帧 */}
      <span className="nav-pill" aria-hidden="true" style={{
        width: `calc((100% - 12px) * ${weights[pillIndex] / total})`,
        transform: `translateX(${before / weights[pillIndex] * 100}%)`,
      }}/>
      {mobileTabs.map(t => (
        <a key={t.hash} href={`#${t.hash === 'domestic' && modules.circulation ? inventoryPage : t.hash}`}
           className={(tabActive(t.hash) ? 'active' : '') + (counts[t.count] ? ' has-badge' : '')}
           aria-current={tabActive(t.hash) ? 'page' : 'false'}>
          <span className="tab-ico"><NavIcon name={t.hash}/>
            {counts[t.count] ? <b className="tab-badge num">{counts[t.count]}</b> : null}</span>
          <span className="tab-label">{t.label}</span>
        </a>
      ))}
      <a href="#more" className={MORE_HASHES.has(page) ? 'active' : ''}
         aria-current={MORE_HASHES.has(page) ? 'page' : 'false'}>
        <span className="tab-ico" aria-hidden="true"><NavIcon name="more"/></span>
        <span className="tab-label">更多</span>
      </a>
    </nav>
  );
}
