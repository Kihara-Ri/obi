// 完整变化清单（收在设置 · 功能的「全部变化与说明」里）：把当前选择的功能组合对应到界面上的每个位置（手机底栏、桌面侧栏、添加表单、
// 详情管理、批量操作），并与已保存的配置对比——新增的标绿「新增」、将收起的划线「收起」，其余照常显示。
// 数据来自 core/modules 的 SURFACE_GROUPS；纯展示，无状态。图例用文字标记，不只靠颜色。
import {SURFACE_GROUPS} from '../core/modules';
import type {ModuleFlags, StartPage} from '../types';
import './ModuleImpact.css';

export interface ModuleImpactProps {
  next: ModuleFlags; nextHome: StartPage;
  /** 已保存的配置；首次设置时没有，全部按「出现」显示 */
  saved?: ModuleFlags; savedHome?: StartPage;
}

/** 变化条目总数（新增 + 收起），用于保存按钮旁的摘要 */
export function countImpact({next, nextHome, saved, savedHome}: ModuleImpactProps): {added: number; removed: number} {
  let added = 0, removed = 0;
  if (!saved) return {added, removed};
  for (const g of SURFACE_GROUPS) for (const it of g.items) {
    const was = it.show(saved, savedHome ?? 'domestic'), now = it.show(next, nextHome);
    if (now && !was) added++;
    if (!now && was) removed++;
  }
  return {added, removed};
}

export function ModuleImpact(props: ModuleImpactProps) {
  const {next, nextHome, saved, savedHome} = props;
  const {added, removed} = countImpact(props);
  return <div className="module-impact" role="group" aria-label="界面变化预览">
    {saved ? <p className="module-impact-sum" role="status">
      {added || removed ? <>相比现在：<b className="is-add">新增 {added} 处</b>，<b className="is-del">收起 {removed} 处</b></> : '与当前界面一致，没有变化'}
    </p> : null}
    {SURFACE_GROUPS.map(g => {
      const rows = g.items.map(it => {
        const now = it.show(next, nextHome);
        const was = saved ? it.show(saved, savedHome ?? 'domestic') : now;
        const label = typeof it.label === 'function' ? it.label(next) : it.label;
        return {id: it.id, label, now, was};
      }).filter(r => r.now || r.was);
      return <section className="module-impact-group" key={g.id} aria-label={g.title}>
        <h4>{g.title}<small>{g.hint}</small></h4>
        <ul>{rows.map(r => {
          const state = r.now && !r.was ? 'add' : !r.now && r.was ? 'del' : 'same';
          return <li key={r.id} className={`is-${state}`}>
            {r.label}{state === 'add' ? <em>新增</em> : state === 'del' ? <em>收起</em> : null}
          </li>;
        })}</ul>
      </section>;
    })}
  </div>;
}
