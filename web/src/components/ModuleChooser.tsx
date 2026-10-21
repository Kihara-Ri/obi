// 功能选择（设置 · 功能 与首次设置共用）：①按使用方式选一套组合 → ②实时预览界面哪些位置会变
// → ③需要时逐项微调、选默认首页 → 保存。保存按钮旁说明相比现在新增 / 收起几处。
import {useEffect, useState} from 'react';
import {api} from '../core/api';
import {homePage, MODULES, PRESETS, sameModules} from '../core/modules';
import {useApp} from '../state/AppContext';
import type {ModuleFlags, StartPage} from '../types';
import {ModuleImpact, countImpact} from './ModuleImpact';
import {ModulePresets} from './ModulePresets';
import {Disclosure} from './ui/Disclosure';
import {Seg} from './ui/Seg';
import {Switch} from './ui/Switch';
import {navigate} from '../core/nav';

export function ModuleChooser({initial = false}: {initial?: boolean}) {
  const app = useApp();
  const savedHome: StartPage = app.state.modules?.startPage ?? 'domestic';
  const [enabled, setEnabled] = useState<ModuleFlags>(initial ? {...PRESETS[0].enabled} : {...app.modules});
  const [startPage, setStartPage] = useState<StartPage>(savedHome);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!initial) { setEnabled({...app.modules}); setStartPage(savedHome); }
  }, [app.modules.acquisition, app.modules.trading, app.modules.circulation, app.modules.showcase, savedHome, initial]);

  // 海外周转依赖购入记录：开启它时带上购入记录，关闭购入记录时同时关闭海外周转
  const toggle = (id: keyof ModuleFlags, on: boolean) => setEnabled(prev => ({
    ...prev, [id]: on,
    ...(id === 'circulation' && on ? {acquisition: true} : {}),
    ...(id === 'acquisition' && !on ? {circulation: false} : {}),
  }));
  const pick = (flags: ModuleFlags) => {
    setEnabled(flags);
    if (initial) setStartPage(flags.showcase ? 'gallery' : 'domestic');
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      await api('modules', {enabled, startPage});
      await app.refresh();
      app.setSelected(new Set());
      app.setShelfFilter('all');
      if (initial) navigate(`#${homePage(startPage, enabled)}`);
      app.toast(initial ? '已准备好，添加第一张专辑吧' : '功能与首页选择已更新');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  if (typeof app.state.modules?.enabled.showcase !== 'boolean') return <p className="small-note">
    当前后端尚未支持收藏展示与首页设置。重启碟渡服务后即可调整，原有收藏仍可继续使用。
  </p>;

  const saved = initial || !app.state.modules?.configured ? undefined : app.modules;
  const impact = {next: enabled, nextHome: startPage, saved, savedHome};
  const {added, removed} = countImpact(impact);
  const unchanged = !initial && !!saved && sameModules(enabled, saved) && startPage === savedHome;
  const child = (id: keyof ModuleFlags) => id === 'circulation';

  return (
    <div className="module-chooser">
      <h3 className="module-step"><b>1</b>你打算怎么用碟渡？</h3>
      <ModulePresets value={enabled} disabled={saving} onPick={pick}/>

      <h3 className="module-step"><b>2</b>界面会这样变化</h3>
      <ModuleImpact {...impact}/>

      <h3 className="module-step"><b>3</b>微调与首页</h3>
      <Disclosure summary="逐项开关功能">
        <div className="module-rows">
          <div className="module-row is-base"><strong>基础收藏<small>照片、搜索、备份与导出，始终开启</small></strong>
            <Switch on label="基础收藏（始终开启）" disabled onToggle={() => {}}/></div>
          {MODULES.map(m => {
            const locked = m.id === 'circulation' && !enabled.acquisition ? '需先开启购入记录' : undefined;
            return <div className={`module-row${child(m.id) ? ' is-child' : ''}`} key={m.id}>
              <strong>{m.name}<small>{locked ?? m.desc}</small></strong>
              <Switch on={enabled[m.id]} label={m.name} disabled={saving || Boolean(locked)} onToggle={() => toggle(m.id, !enabled[m.id])}/>
            </div>;
          })}
        </div>
        <p className="small-note">关闭模块只收起相关入口，原有购买、包裹和交易记录全部保留；重新开启后可以继续处理。添加、编辑与完整管理入口一直保留。</p>
      </Disclosure>
      <div className="module-start-page">
        <strong>打开应用时进入</strong>
        <Seg ariaLabel="默认首页" value={homePage(startPage, enabled)}
          options={[{value: 'domestic', label: '收藏管理'}, ...(enabled.showcase ? [{value: 'gallery', label: '收藏展示'}] : [])]}
          onValue={v => { if (!saving) setStartPage(v as StartPage); }}/>
        {!enabled.showcase && startPage === 'gallery'
          ? <p className="small-note">展示模块已关闭，将进入收藏管理；重新开启后会恢复你的展示首页选择。</p> : null}
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="module-save">
        <button type="button" className="primary" disabled={saving || unchanged} onClick={save}>
          {saving ? '保存中…' : initial ? '开始使用' : '保存功能选择'}</button>
        {!initial && !unchanged ? <span className="small-note">新增 {added} 处 · 收起 {removed} 处</span> : null}
      </div>
    </div>
  );
}
