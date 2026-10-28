// 全局文案预设在此就地管理；选择后保存为默认，自定义内容须显式保存再用于生成。
import {useState} from 'react';
import type {ListingPreferences as Preferences} from '../../core/listing';
import {Dropdown} from '../ui/Dropdown';
import {Details} from '../ui/Details';
import './ListingPreferences.css';

type Props = {value: Preferences; onSave: (next: Preferences) => Promise<void>};
export function ListingPreferences({value, onSave}: Props) {
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rows = [...value.builtins, ...value.customPresets];
  const save = async (next: Preferences) => {
    setBusy(true); setError('');
    try {await onSave(next); return true;}
    catch (e) {setError(e instanceof Error ? e.message : '预设保存失败'); return false;}
    finally {setBusy(false);}
  };
  const pick = (id: string) => {
    const row = value.customPresets.find(item => item.id === id);
    setEditing(row?.id ?? ''); setName(row?.name ?? ''); setInstructions(row?.instructions ?? '');
  };
  return <div className="listing-preferences">
    <Dropdown label="文案风格" value={value.defaultPreset} disabled={busy}
      options={rows.map(row => ({value: row.id, label: row.name}))}
      onPick={id => {void save({...value, defaultPreset: id});}}/>
    <Details summary="自定义预设">
      <Dropdown label="编辑预设" value={editing} disabled={busy}
        options={[{value: '', label: '新建预设'}, ...value.customPresets.map(row => ({value: row.id, label: row.name}))]}
        onPick={pick}/>
      <label>预设名称<input value={name} maxLength={60} disabled={busy} onChange={e => setName(e.target.value)}/></label>
      <label>写作要求<textarea rows={3} value={instructions} maxLength={6000} disabled={busy}
        placeholder="语气、篇幅、结构、禁用词或固定结尾" onChange={e => setInstructions(e.target.value)}/></label>
      <div className="listing-actions">
        <button type="button" disabled={busy || !name.trim()} onClick={async () => {
          const id = editing || crypto.randomUUID();
          const customPresets = [...value.customPresets.filter(row => row.id !== id), {id, name, instructions}];
          if (await save({...value, customPresets, defaultPreset: id})) setEditing(id);
        }}>保存并使用</button>
        {editing ? <button type="button" disabled={busy} onClick={async () => {
          if (await save({...value, customPresets: value.customPresets.filter(row => row.id !== editing),
            defaultPreset: value.defaultPreset === editing ? 'concise' : value.defaultPreset})) pick('');
        }}>删除预设</button> : null}
      </div>
    </Details>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </div>;
}
