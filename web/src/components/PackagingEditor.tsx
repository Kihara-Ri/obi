import {useState} from 'react';
import type {PackagingSpec} from '../types';
import {albumPackaging, PACKAGING_PHOTO_ROLES, PACKAGING_PRESETS, packagingSuggestions, setPackagingPhoto} from '../core/album-packaging';
import {Dropdown} from './ui/Dropdown';

export function PackagingEditor({version, value, photos, onChange, onValidity}: {
  version: string; value: PackagingSpec | null;
  photos: {index: number; source: string}[];
  onChange(value: PackagingSpec | null): void;
  onValidity(message: string | null): void;
}) {
  const model = albumPackaging(version, value);
  const [size, setSize] = useState(() => [value?.size?.width, value?.size?.height, value?.size?.depth].map(n => n === undefined ? '' : String(n)));
  const change = (patch: Partial<PackagingSpec>) => onChange({...value, ...patch});
  const dimension = (index: number, text: string) => {
    const next = size.map((s, i) => i === index ? text : s); setSize(next);
    const result = {...value}; delete result.size;
    if (next.some(Boolean)) {
      const numbers = next.map(Number);
      if (next.some(s => !s) || numbers.some((n, i) => !Number.isFinite(n) || n < [50, 50, .1][i] || n > [500, 700, 300][i])) {
        onValidity('请完整填写有效的包装宽、高、厚度（mm）'); onChange(result); return;
      }
      result.size = {width: numbers[0], height: numbers[1], depth: numbers[2]};
    }
    onValidity(null); onChange(result);
  };
  const suggestions = model.kind === 'unknown' ? packagingSuggestions(version) : [];
  return <section className="packaging-editor" aria-label="包装结构与贴图">
    {suggestions.length ? <div className="packaging-suggestions"><p>原记录「{version}」未说明开合结构，请按实物确认：</p>
      {suggestions.map(p => <button type="button" className="quiet" key={p.value}
        onClick={() => change(p.spec)}>{p.label}</button>)}
    </div> : null}
    <div className="packaging-fields">
      <div className="field"><label>包装结构</label><Dropdown id="pack-structure" label="包装结构"
        value={model.kind === 'unknown' ? '__none' : model.kind}
        options={[{value: '__none', label: '未确认'}, ...PACKAGING_PRESETS.filter(p => p.value === p.spec.structure).map(p => ({value: p.value, label: p.label}))]}
        onPick={v => change({structure: v === '__none' ? 'unknown' : v as PackagingSpec['structure']})}/></div>
      <div className="field"><label>表面处理</label><Dropdown id="pack-finish" label="包装表面处理" value={value?.finish ?? '__default'}
        options={[{value: '__default', label: '按包装默认'}, {value: 'uncoated', label: 'Uncoated · 未覆膜'}, {value: 'matte', label: 'Matte · 哑光'}, {value: 'gloss', label: 'Gloss · 亮光'}]}
        onPick={v => {const next = {...value}; if (v === '__default') delete next.finish; else next.finish = v as PackagingSpec['finish']; onChange(next);}}/></div>
      {model.kind === 'jewel' ? <>
        <div className="field"><label>Jewel Case 厚度</label><Dropdown id="pack-thickness" label="Jewel Case 厚度" value={value?.thickness ?? 'standard'}
          options={[{value: 'slim', label: 'Slimline'}, {value: 'standard', label: 'Standard'}, {value: 'thick', label: 'Multi-CD / Fatbox'}]}
          onPick={v => change({thickness: v as PackagingSpec['thickness']})}/></div>
      </> : null}
      {model.kind !== 'unknown' ? <div className="field"><label>容纳碟数</label><Dropdown id="pack-discs" label="包装容纳碟数" value={String(model.discs)}
        options={[1, 2, 3, 4].map(n => ({value: String(n), label: n + ' CD'}))}
        onPick={v => change({discs: Number(v) as PackagingSpec['discs']})}/></div> : null}
      {model.kind !== 'jewel' && model.kind !== 'rigid-box' && model.kind !== 'unknown' ? <div className="field"><label>Board Thickness · 纸板厚度</label>
        <Dropdown id="pack-board" label="纸板厚度" value={value?.thickness ?? 'standard'}
          options={[{value: 'slim', label: 'Thin Board'}, {value: 'standard', label: 'Standard Board'}, {value: 'thick', label: 'Heavyweight Board'}]}
          onPick={v => change({thickness: v as PackagingSpec['thickness']})}/></div> : null}
      {model.kind === 'gatefold' || model.kind === 'digipak' ? <div className="field"><label>展开面数</label><Dropdown id="pack-panels" label="包装展开面数" value={String(model.panels)}
        options={[2, 3, 4].map(n => ({value: String(n), label: n * 2 + '-panel'}))}
        onPick={v => change({panels: Number(v) as PackagingSpec['panels']})}/></div> : null}
      {['gatefold', 'digibook', 'rigid-box'].includes(model.kind) ? <div className="field"><label>CD 收纳结构</label><Dropdown id="pack-holder" label="CD 收纳结构" value={model.holder}
        options={[{value: 'pocket', label: 'Pocket · 口袋'}, {value: 'tray', label: 'Tray · 托盘'}]}
        onPick={v => change({holder: v as PackagingSpec['holder']})}/></div> : null}
      {model.holder === 'tray' ? <div className="field"><label>托盘材质</label><Dropdown id="pack-tray" label="CD 托盘材质" value={model.tray}
        options={[{value: 'clear', label: 'Clear Tray'}, {value: 'black', label: 'Black Tray'}, {value: 'white', label: 'White Tray'}]}
        onPick={v => change({tray: v as PackagingSpec['tray']})}/></div> : null}
      {model.holder === 'pocket' && model.kind !== 'card-sleeve' ? <div className="field"><label>口袋位置</label><Dropdown id="pack-pockets" label="包装口袋位置" value={model.pockets}
        options={[{value: 'left', label: '左侧'}, {value: 'right', label: '右侧'}, {value: 'both', label: '两侧'}]}
        onPick={v => change({pockets: v as PackagingSpec['pockets']})}/></div> : null}
      {model.holder === 'pocket' && model.kind === 'gatefold' ?
        <div className="field"><label>Pocket Opening · 纸袋开口</label><Dropdown id="pack-pocket-opening" label="纸袋开口方向" value={model.pocketOpening}
          options={[{value: 'outer', label: 'Outer Opening · 朝外边开口'}, {value: 'inner', label: 'Inner Opening · 朝书脊开口'}]}
          onPick={v => change({pocketOpening: v as PackagingSpec['pocketOpening']})}/></div> : null}
    </div>
    <div className="packaging-flags">
      <label><input type="checkbox" checked={value?.miniLP ?? model.miniLP} onChange={e => change({miniLP: e.target.checked})}/>Mini LP · LP 包装复刻</label>
      <label><input type="checkbox" checked={value?.slipcase ?? model.slipcase} onChange={e => change({slipcase: e.target.checked})}/>Slipcase · 外部抽套</label>
    </div>
    <details className="adv"><summary>实物尺寸（选填，mm）</summary><div className="packaging-dimensions">
      {['宽度', '高度', '厚度'].map((label, i) => <label key={label}>{label}<input aria-label={'包装' + label + '（mm）'} type="number" step=".1"
        min={[50, 50, .1][i]} max={[500, 700, 300][i]} value={size[i]} inputMode="decimal"
        onChange={e => dimension(i, e.target.value)}/></label>)}
    </div></details>
    <details className="adv"><summary>模型贴图 · 指定实物照片</summary>
      <p className="small-note">建议选择正视照片。已校准的印刷区域直接引用原图；更换贴图照片会清除旧区域。缺少背面或中面时保留示意，不复制正面封面。</p>
      <div className="packaging-photo-preview">{photos.map(p => <figure key={p.index}><img src={p.source} alt={'贴图候选照片 ' + (p.index + 1)}/><figcaption>{p.index + 1}</figcaption></figure>)}</div>
      <div className="packaging-fields">{PACKAGING_PHOTO_ROLES.map(role => <div className="field" key={role.value}><label>{role.label}</label>
        <Dropdown id={'pack-photo-' + role.value} label={'包装贴图：' + role.label} value={value?.photos?.[role.value] === undefined ? '__none' : String(value.photos[role.value])}
          options={[{value: '__none', label: role.value === 'front' ? '使用专辑封面' : '暂无贴图'}, ...photos.map(p => ({value: String(p.index), label: '实物照片 ' + (p.index + 1)}))]}
          onPick={v => onChange(setPackagingPhoto(value, role.value, v === '__none' ? undefined : Number(v)))}/>
      </div>)}</div>
    </details>
  </section>;
}
