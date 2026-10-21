import type {ReleaseInfo} from '../types';
import {releaseRegion} from '../core/release-metadata';
import './ReleaseMetadataFields.css';

const fields: {key: keyof ReleaseInfo; label: string; hint?: string; short?: boolean}[] = [
  {key: 'catalogNumber', label: '唱片编号'}, {key: 'barcode', label: '条码'},
  {key: 'packaging', label: '包装'}, {key: 'edition', label: '版次 / 版本说明'},
  {key: 'country', label: '地区代码', short: true, hint: 'JP 表示日版，其余非空代码显示为外版'},
  {key: 'releaseDate', label: '发行日期', short: true}, {key: 'label', label: '厂牌'},
  {key: 'format', label: '介质', short: true}, {key: 'discCount', label: '碟数', short: true},
  {key: 'matrix', label: '内圈刻码'},
];
// omit：已在上方检索区编辑的字段（条码、唱片编号）不在这里重复出现。
export function ReleaseMetadataFields({info, oldPressing, omit = [], onChange, onUnofficial}: {
  info: ReleaseInfo; oldPressing?: string; omit?: (keyof ReleaseInfo)[];
  /** 提供时在最上面显示「非官方发行」开关（私版没有资料库条目，按手动录入处理）。 */
  onUnofficial?: (on: boolean) => void;
  onChange: (key: keyof ReleaseInfo, value: string) => void;
}) {
  return <details className="adv record-release-fields">
    <summary>手动更正发行资料（极少用）
      {info.country ? ' · ' + releaseRegion(info.country, oldPressing) : ''}
      {info.unofficial === '1' ? ' · 非官方' : ''}
    </summary>
    {onUnofficial ? <label className="rmf-unofficial">
      <input type="checkbox" checked={info.unofficial === '1'} onChange={e => onUnofficial(e.target.checked)}/>
      <span><b>非官方发行（私版 / Bootleg）</b><small>资料库里没有条目；按手动录入处理，不核对资料库、不生成 3D</small></span>
    </label> : null}
    <div className="form-grid rmf-grid">
      {fields.filter(f => !omit.includes(f.key)).map(({key, label, hint, short}) => <div className={'field' + (short ? '' : ' full')} key={key}>
        <label htmlFor={'release-' + key}>{label}</label>
        <input id={'release-' + key} type="text" value={(info[key] as string) || ''}
          onChange={e => onChange(key, e.target.value)} title={hint}/>
      </div>)}
    </div>
  </details>;
}
