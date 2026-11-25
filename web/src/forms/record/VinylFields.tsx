// 黑胶副本的规格与品相（D-055）：尺寸 / 转速 / 彩胶，唱片与封套分开评级，全部可选。
// 尺寸没选时显示从格式认出的值（12" Vinyl → 12″）；再点一次已选的尺寸或转速就清空。
import {Seg} from '../../components/ui/Seg';
import {FocusField} from '../FocusField';
import {GRADES, VINYL_SIZES, VINYL_SPEEDS, formatSize, type VinylSpec} from '../../core/vinyl';
import type {FormCtx} from './context';

export function VinylFields({ctx}: {ctx: FormCtx}) {
  const {v, set, dirty} = ctx;
  const spec = v.vinyl ?? {};
  const patch = (change: Partial<VinylSpec>) => { set({vinyl: {...spec, ...change}}); dirty(); };
  const toggle = <K extends 'size' | 'speed'>(key: K, value: string) =>
    patch({[key]: spec[key] === value ? undefined : value} as Partial<VinylSpec>);
  const grades = [...GRADES.map(g => ({value: g.value, label: g.label, title: g.hint})), {value: '', label: '未评'}];
  return <section className="record-vinyl form-section" aria-label="黑胶规格与品相">
    <div className="record-vinyl-row">
      <span className="record-vinyl-label">尺寸</span>
      <Seg ariaLabel="尺寸" value={spec.size || formatSize(v.releaseInfo)} onValue={x => toggle('size', x)}
        options={VINYL_SIZES.map(s => ({value: s, label: `${s}″`}))}/>
    </div>
    <div className="record-vinyl-row">
      <span className="record-vinyl-label">转速</span>
      <Seg ariaLabel="转速" value={spec.speed || ''} onValue={x => toggle('speed', x)}
        options={VINYL_SPEEDS.map(s => ({value: s.value, label: s.label}))}/>
    </div>
    <FocusField label="彩胶（颜色，黑色不填）" name="vinyl-color" value={spec.color || ''}
      onValue={color => patch({color})}/>
    <div className="record-vinyl-row">
      <span className="record-vinyl-label">唱片品相</span>
      <Seg ariaLabel="唱片品相" value={spec.mediaGrade || ''} options={grades}
        onValue={x => patch({mediaGrade: (x || undefined) as VinylSpec['mediaGrade']})}/>
    </div>
    <div className="record-vinyl-row">
      <span className="record-vinyl-label">封套品相</span>
      <Seg ariaLabel="封套品相" value={spec.sleeveGrade || ''} options={grades}
        onValue={x => patch({sleeveGrade: (x || undefined) as VinylSpec['sleeveGrade']})}/>
    </div>
    <p className="record-vinyl-hint">品相按 Goldmine 分级：M 全新未拆 · NM 近全新 · VG+ 轻微痕迹 · VG 明显痕迹 · G 磨损重</p>
  </section>;
}
