// 售卖核对：证据与公开描述分开；选版、采用观察和确认均由用户显式操作。
import type {ListingDraft} from '../../core/listing';
import {candidateText} from '../../core/listing';
import {Dropdown} from '../ui/Dropdown';
import './ListingReview.css';

type Props = {draft: ListingDraft; onChange: (draft: ListingDraft) => void};
export function ListingReview({draft, onChange}: Props) {
  const analysis = draft.analysis;
  const change = (patch: Partial<ListingDraft>) => onChange({...draft, ...patch});
  return <section className="listing-review" aria-label="版本与品相核对">
    {analysis ? <details open>
      <summary>照片分析依据</summary>
      {[...analysis.identifiers, ...analysis.observations].map((row, i) => <p key={i}>
        {row.text} <span className="small-note">（照片 {row.photos.map(n => n + 1).join('、')}）</span>
      </p>)}
      {analysis.pending.length ? <><strong>待确认 · 不写入文案</strong><ul>{analysis.pending.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}
      {analysis.catalogError ? <p role="status">发行资料查询未完成：{analysis.catalogError}</p> : null}
      {!analysis.candidates.length ? <p className="small-note">未找到可确认的发行版；可补拍标识，或手动填写已核对的信息。</p> : null}
    </details> : null}
    {analysis?.candidates.length ? <>
      <Dropdown label="发行版本候选" value={draft.selectedRelease ?? ''}
        options={[{value: '', label: '请选择并核对，留空表示版本未确定'},
          ...analysis.candidates.map(row => ({value: row.id, label: candidateText(row)}))]}
        onPick={value => {const row = analysis.candidates.find(item => item.id === value);
          change({selectedRelease: value, versionText: row ? candidateText(row) : '', versionConfirmed: false});}}/>
      {draft.selectedRelease ? <a href={`https://musicbrainz.org/release/${encodeURIComponent(draft.selectedRelease)}`}
        target="_blank" rel="noopener noreferrer">查看版本资料 ↗</a> : null}
    </> : null}
    <label>版本说明（不确定的内容留空）<textarea value={draft.versionText} rows={2} maxLength={3000}
      onChange={e => change({versionText: e.target.value, versionConfirmed: false})}/></label>
    <label className="listing-confirm"><input type="checkbox" checked={draft.versionConfirmed}
      onChange={e => change({versionConfirmed: e.target.checked})}/>已核对版本说明，未确定的信息已留空</label>
    {analysis?.observations.length ? <button type="button" onClick={() => change({
      conditionText: analysis.observations.map(row => row.text).join('\n'), conditionConfirmed: false})}>采用照片观察到品相说明</button> : null}
    <label>品相说明<textarea value={draft.conditionText} rows={3} maxLength={6000}
      onChange={e => change({conditionText: e.target.value, conditionConfirmed: false})}/></label>
    <label className="listing-confirm"><input type="checkbox" checked={draft.conditionConfirmed}
      onChange={e => change({conditionConfirmed: e.target.checked})}/>已核对品相与附件；试听情况由我确认</label>
  </section>;
}
