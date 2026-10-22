// 「更多」：入口列表。一行一件事——图标、名称、右侧数字，没有副标题；分组只有「账本」「偏好」。
// 展示收藏不在这里：它是一级入口（手机底栏「展示」、桌面侧栏「收藏展示」）。
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {InstallNavItem} from '../components/InstallNavItem';
import {ThemeToggle} from '../components/ThemeToggle';
import {NavRow} from '../components/ui/NavRow';
import {GearIcon} from '../components/ui/GearIcon';
import {isLocalSite} from '../core/backend';

export function MorePage({installEvt, onInstalled}: {installEvt: Event | null; onInstalled: () => void}) {
  const {modules, state} = useApp();
  const trades = state.sales.filter(s => s.status === 'complete').length;
  const inStock = state.records.filter(r => ['overseas', 'transit', 'domestic'].includes(r.status)).length;
  const hasLedger = modules.acquisition || modules.trading;
  return <>
    <PageHead title="更多" label="YOUR LEDGER"/>
    <div className="more-page">
      <section aria-labelledby="more-lookup">
        <h2 id="more-lookup">查询</h2>
        <nav aria-label="查询">
          <NavRow href="#lookup" icon="⌕" title="条码 / 编号查询"/>
        </nav>
      </section>
      {hasLedger ? <section aria-labelledby="more-records">
        <h2 id="more-records">账本</h2>
        <nav aria-label="账本与记录">
          <NavRow href="#stats" icon="▧" title="账本" value={`${inStock} 张`}/>
          {modules.trading ? <NavRow href="#trades" icon="↗" title="交易记录" value={trades || ''}/> : null}
        </nav>
      </section> : null}
      <section aria-labelledby="more-manage">
        <h2 id="more-manage">偏好</h2>
        <nav aria-label="偏好与设置">
          <NavRow href="#settings" icon={<GearIcon size={19}/>} title="设置与备份"/>
          <ThemeToggle withLabel/>
          {installEvt ? <InstallNavItem evt={installEvt} onInstalled={onInstalled} row/> : null}
        </nav>
      </section>
      <div className="local-note"><i/> {isLocalSite() ? '数据只保存在这台设备上' : '数据保存在服务设备'}</div>
    </div>
  </>;
}
