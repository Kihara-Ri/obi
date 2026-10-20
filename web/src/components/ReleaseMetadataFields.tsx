import type {ReleaseInfo} from '../types';
import {releaseRegion} from '../core/release-metadata';

const fields: {key: keyof ReleaseInfo; label: string; hint?: string}[] = [
  {key: 'catalogNumber', label: '唱片编号'}, {key: 'barcode', label: '条码'},
  {key: 'packaging', label: '包装'}, {key: 'edition', label: '版次 / 版本说明'},
  {key: 'country', label: '发行地区（MusicBrainz 原始代码）', hint: 'JP 表示日版，其余非空代码显示为外版'},
  {key: 'releaseDate', label: '本版发行日期'}, {key: 'label', label: '厂牌'},
  {key: 'format', label: '介质'}, {key: 'discCount', label: '碟数'},
  {key: 'matrix', label: '内圈刻码'},
];
// omit：已在上方检索区编辑的字段（条码、唱片编号）不在这里重复出现。
export function ReleaseMetadataFields({info, oldPressing, omit = [], onChange}: {
  info: ReleaseInfo; oldPressing?: string; omit?: (keyof ReleaseInfo)[];
  onChange: (key: keyof ReleaseInfo, value: string) => void;
}) {
  return <details className="adv record-release-fields">
    <summary>发行资料 · 查看及更正
      {info.country ? ' · ' + releaseRegion(info.country, oldPressing) : ''}
    </summary>
        <div className="form-grid">
      {fields.filter(f => !omit.includes(f.key)).map(({key, label, hint}) => <div className="field" key={key}>
        <label htmlFor={'release-' + key}>{label}</label>
        <input id={'release-' + key} type="text" value={(info[key] as string) || ''}
          onChange={e => onChange(key, e.target.value)} title={hint}/>
      </div>)}
    </div>
  </details>;
}
