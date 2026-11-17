// 「更多」：入口列表，样式按 2026-11-17 动效样稿：分组小标题 + 圆角卡片，每行 = 图标块 + 名称 + 右侧数字 + 箭头，没有副标题。
// 分组：工具（查询、账本）· 记录（交易记录）· 管理（设置与备份、外观、安装）。外观行沿用 ThemeToggle，不改。
// 展示收藏不在这里：它是一级入口（手机底栏「展示」、桌面侧栏「收藏展示」）。
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {InstallNavItem} from '../components/InstallNavItem';
import {ThemeToggle} from '../components/ThemeToggle';
import {NavRow} from '../components/ui/NavRow';
import {isLocalSite} from '../core/backend';

// 线性图标与外观切换同风格（stroke 1.8、圆角端点）
const Ico = ({d}: {d: string}) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d}/>
  </svg>
);
const SEARCH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5';
const BOOK = 'M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2';
const SWAP = 'M4 8h14l-3-3M20 16H6l3 3';
const GEAR = 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1';

export function MorePage({installEvt, onInstalled}: {installEvt: Event | null; onInstalled: () => void}) {
  const {modules, state} = useApp();
  const trades = state.sales.filter(s => s.status === 'complete').length;
  const inStock = state.records.filter(r => ['overseas', 'transit', 'domestic'].includes(r.status)).length;
  const hasLedger = modules.acquisition || modules.trading;
  return <>
    <PageHead title="更多" label="YOUR LEDGER"/>
    <div className="more-page">
      <section aria-labelledby="more-tools">
        <h2 id="more-tools">工具</h2>
        <nav aria-label="工具">
          <NavRow href="#lookup" icon={<Ico d={SEARCH}/>} title="编号查询"/>
          {hasLedger ? <NavRow href="#stats" icon={<Ico d={BOOK}/>} title="账本" value={`${inStock} 张`}/> : null}
        </nav>
      </section>
      {modules.trading ? <section aria-labelledby="more-records">
        <h2 id="more-records">记录</h2>
        <nav aria-label="记录">
          <NavRow href="#trades" icon={<Ico d={SWAP}/>} title="交易记录" value={trades ? `${trades} 笔` : ''}/>
        </nav>
      </section> : null}
      <section aria-labelledby="more-manage">
        <h2 id="more-manage">管理</h2>
        <nav aria-label="管理">
          <NavRow href="#settings" icon={<Ico d={GEAR}/>} title="设置与备份"/>
          <ThemeToggle withLabel/>
          {installEvt ? <InstallNavItem evt={installEvt} onInstalled={onInstalled} row/> : null}
        </nav>
      </section>
      <div className="local-note"><i/> {isLocalSite() ? '数据只保存在这台设备上' : '数据保存在服务设备'}</div>
    </div>
  </>;
}
