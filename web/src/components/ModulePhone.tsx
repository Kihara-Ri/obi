// 迷你手机预览：用一部示意手机实时演示选择的效果——屏幕里是「专辑详情 · 管理」会出现的项，
// 底部是手机底栏。与已保存配置相比：新增项弹入并带「+」角标，将收起的项变虚线、带「−」角标（不只靠颜色）。
// 数据来自 core/modules 的 SURFACE_GROUPS（mobile、detail 两组），与导航和详情页的模块判断同源。
import {SURFACE_GROUPS} from '../core/modules';
import type {ModuleIconKey} from '../core/modules';
import type {ModuleFlags, StartPage} from '../types';
import {ModuleIcon} from './moduleIcons';
import type {ModuleImpactProps} from './ModuleImpact';

type Row = {id: string; icon: ModuleIconKey; label: string; state: 'add' | 'del' | 'same'};

function rows(groupId: string, next: ModuleFlags, nextHome: StartPage, saved?: ModuleFlags, savedHome?: StartPage): Row[] {
  const g = SURFACE_GROUPS.find(x => x.id === groupId);
  if (!g) return [];
  return g.items.flatMap(it => {
    const now = it.show(next, nextHome);
    const was = saved ? it.show(saved, savedHome ?? 'domestic') : now;
    if (!now && !was) return [];
    const label = typeof it.label === 'function' ? it.label(now ? next : saved ?? next) : it.label;
    return [{id: it.id, icon: it.icon ?? 'disc', label, state: (now && !was ? 'add' : !now ? 'del' : 'same') as Row['state']}];
  });
}

const Mark = ({state}: {state: Row['state']}) =>
  state === 'same' ? null : <i className="module-phone-mark" aria-label={state === 'add' ? '新增' : '收起'}>{state === 'add' ? '+' : '−'}</i>;

export function ModulePhone({next, nextHome, saved, savedHome}: ModuleImpactProps) {
  const detail = rows('detail', next, nextHome, saved, savedHome);
  const tabs = rows('mobile', next, nextHome, saved, savedHome);
  return <figure className="module-phone" aria-label="手机界面预览">
    <div className="module-phone-screen">
      <div className="module-phone-album" aria-hidden="true"><span/><div><b/><b/></div></div>
      <ul className="module-phone-detail" aria-label="专辑详情 · 管理">
        {detail.length ? detail.map(r => <li key={r.id} className={`is-${r.state}`}>
          <ModuleIcon name={r.icon} size={15}/><span>{r.label}</span><Mark state={r.state}/>
        </li>) : <li className="is-empty" aria-label="无管理项"><b/><b/></li>}
      </ul>
    </div>
    <ul className="module-phone-tabs" aria-label="手机底栏">
      {tabs.map(r => <li key={r.id} className={`is-${r.state}`}>
        <ModuleIcon name={r.icon} size={17}/><span>{r.label}</span><Mark state={r.state}/>
      </li>)}
    </ul>
  </figure>;
}
