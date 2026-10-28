// 文案风格：一个下拉选内置风格或「我的风格」；我的风格用几组选项（语气 / 篇幅 / 排版 / 标题 / 包含项 / 固定结尾）配置，
// 拼成写作要求交给模型，不让用户从零写提示词。选择风格即保存为全局默认，「我的风格」须显式保存才生效。
import {useEffect, useState} from 'react';
import type {ListingPreferences as Preferences} from '../../core/listing';
import {DEFAULT_STYLE, STYLE_GROUPS, composeInstructions, describeStyle} from '../../core/listing-style';
import type {StyleOptions} from '../../core/listing-style';
import {Dropdown} from '../ui/Dropdown';
import {Seg} from '../ui/Seg';
import {Switch} from '../ui/Switch';
import './ListingPreferences.css';

const NEW = '__new';
const MINE = 'mine';
const FLAGS: {key: 'tracks' | 'condition' | 'emoji'; label: string}[] = [
  {key: 'tracks', label: '列出曲目'}, {key: 'condition', label: '品相与附件单独成段'}, {key: 'emoji', label: '少量表情符号'}];

type Props = {value: Preferences; onSave: (next: Preferences) => Promise<void>};
export function ListingPreferences({value, onSave}: Props) {
  const [creating, setCreating] = useState(false);
  const [base, setBase] = useState<Partial<StyleOptions>>({});
  const [opts, setOpts] = useState<StyleOptions>(DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = creating ? NEW : value.defaultPreset;
  const builtin = value.builtins.find(row => row.id === selected);
  const custom = value.customPresets.find(row => row.id === selected);
  const hasMine = value.customPresets.some(row => row.id === MINE);
  useEffect(() => {
    if (creating) setOpts({...DEFAULT_STYLE, ...base});
    else if (custom) // 旧的自由文本风格没有选项：各组留空，原文字放进「其他要求」，保存后才改写。
      setOpts(custom.options ? {...DEFAULT_STYLE, ...custom.options} : {...DEFAULT_STYLE, tone: '', length: '', layout: '', title: '',
        condition: false, extra: custom.instructions});
  }, [creating, base, custom?.id, custom?.instructions, JSON.stringify(custom?.options)]);
  const save = async (next: Preferences) => {
    setBusy(true); setError('');
    try {await onSave(next); return true;}
    catch (e) {setError(e instanceof Error ? e.message : '风格保存失败'); return false;}
    finally {setBusy(false);}
  };
  const set = <K extends keyof StyleOptions>(key: K, v: StyleOptions[K]) => setOpts(o => ({...o, [key]: v}));
  const changed = !custom || JSON.stringify({...DEFAULT_STYLE, ...custom.options}) !== JSON.stringify(opts) || !custom.options;
  const instructions = composeInstructions(opts);
  return <div className="listing-preferences">
    <Dropdown label="文案风格" value={selected} disabled={busy}
      options={[...value.builtins, ...value.customPresets].map(row => ({value: row.id, label: row.name}))
        .concat(hasMine ? [] : [{value: NEW, label: '＋ 我的风格'}])}
      onPick={id => {
        if (id === NEW) {setBase(builtin?.options ?? {}); setCreating(true); return;}
        setCreating(false); void save({...value, defaultPreset: id});
      }}/>
    {builtin ? <div className="listing-style-summary">
      <span>{describeStyle(builtin.options ?? {})}</span>
      {!hasMine ? <button type="button" disabled={busy} onClick={() => {setBase(builtin.options ?? {}); setCreating(true);}}>以此为基础，做我的风格</button> : null}
    </div> : null}
    {creating || custom ? <div className="listing-style-editor">
      {STYLE_GROUPS.map(group => <div className="listing-style-row" key={group.key}>
        <span>{group.label}</span>
        <Seg ariaLabel={group.label} value={opts[group.key]} disabled={busy} onValue={v => set(group.key, v)}
          options={group.options.map(c => ({value: c.value, label: c.label}))}/>
      </div>)}
      {FLAGS.map(flag => <div className="listing-style-flag" key={flag.key}>
        <span>{flag.label}</span><Switch label={flag.label} on={opts[flag.key]} disabled={busy} onToggle={() => set(flag.key, !opts[flag.key])}/>
      </div>)}
      <label>固定结尾（选填）<input value={opts.ending} maxLength={300} disabled={busy} placeholder="例如：不议价，拍下即发"
        onChange={e => set('ending', e.target.value)}/></label>
      <label>其他要求（选填）<input value={opts.extra} maxLength={1000} disabled={busy} placeholder="例如：不要用“绝版”“稀有”"
        onChange={e => set('extra', e.target.value)}/></label>
      <p className="listing-style-preview">会告诉模型：{instructions}</p>
      <div className="listing-actions">
        <button type="button" disabled={busy || !changed} onClick={async () => {
          const id = custom?.id ?? MINE;
          const row = {id, name: custom?.name ?? '我的风格', instructions, options: opts};
          if (await save({...value, customPresets: [...value.customPresets.filter(r => r.id !== id), row], defaultPreset: id})) setCreating(false);
        }}>{creating ? '保存并使用' : '保存修改'}</button>
        {custom ? <button type="button" disabled={busy} onClick={() => {
          void save({...value, customPresets: value.customPresets.filter(r => r.id !== custom.id), defaultPreset: 'concise'});
        }}>删除风格</button> : null}
        {creating ? <button type="button" disabled={busy} onClick={() => setCreating(false)}>取消</button> : null}
      </div>
    </div> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
  </div>;
}
