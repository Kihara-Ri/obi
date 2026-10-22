// 功能选择（设置 · 功能 与首次设置共用）：顶部图标卡选一套使用方式 → 下方图标开关逐项微调、选默认首页，
// 旁边迷你手机实时演示底栏与详情管理的变化 → 保存。完整变化清单与说明收在「全部变化与说明」里。
import {useEffect, useState} from 'react';
import {api} from '../core/api';
import {homePage, PRESETS, sameModules} from '../core/modules';
import {useApp} from '../state/AppContext';
import type {ModuleFlags, StartPage} from '../types';
import {ModuleImpact, countImpact} from './ModuleImpact';
import {ModulePresets} from './ModulePresets';
import {Disclosure} from './ui/Disclosure';
import {Seg} from './ui/Seg';
import {ModuleTiles} from './ModuleTiles';
import {ModulePhone} from './ModulePhone';
import {ModuleIcon} from './moduleIcons';
import './ModuleChooser.css';
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
    当前后端尚未支持收藏展示与首页设置。重启 Obi 服务后即可调整，原有收藏仍可继续使用。
  </p>;

  const saved = initial || !app.state.modules?.configured ? undefined : app.modules;
  const impact = {next: enabled, nextHome: startPage, saved, savedHome};
  const {added, removed} = countImpact(impact);
  const unchanged = !initial && !!saved && sameModules(enabled, saved) && startPage === savedHome;
  const homeLabel = (icon: 'list' | 'grid', text: string) => <span className="module-home-opt"><ModuleIcon name={icon} size={15}/>{text}</span>;

  return (
    <div className="module-chooser">
      <ModulePresets value={enabled} disabled={saving} onPick={pick}/>
      <div className="module-chooser-main">
        <div className="module-chooser-controls">
          <ModuleTiles value={enabled} disabled={saving} onToggle={toggle}/>
          <div className="module-start-page">
            <strong>打开时进入</strong>
            <Seg ariaLabel="默认首页" value={homePage(startPage, enabled)}
              options={[{value: 'domestic', label: homeLabel('list', '管理')},
                ...(enabled.showcase ? [{value: 'gallery', label: homeLabel('grid', '展示')}] : [])]}
              onValue={v => { if (!saving) setStartPage(v as StartPage); }}/>
          </div>
        </div>
        <ModulePhone {...impact}/>
      </div>
      <Disclosure summary="全部变化与说明">
        <ModuleImpact {...impact}/>
        <p className="small-note">基础收藏（照片、搜索、备份与导出）始终开启。关闭模块只收起入口，原有购买、包裹和交易记录全部保留，重新开启即可继续。</p>
        {!enabled.showcase && startPage === 'gallery'
          ? <p className="small-note">展示已关闭，将进入收藏管理；重新开启后恢复展示首页。</p> : null}
      </Disclosure>

      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="module-save">
        <button type="button" className="primary" disabled={saving || unchanged} onClick={save}>
          {saving ? '保存中…' : initial ? '开始使用' : '保存'}</button>
        {added || removed ? <span className="module-save-diff" aria-label={`新增 ${added} 处，收起 ${removed} 处`}>
          <b className="is-add">+{added}</b><b className="is-del">−{removed}</b></span> : null}
      </div>
    </div>
  );
}
