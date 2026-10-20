// 售卖核对：证据与公开描述分开；选版、采用观察和确认均由用户显式操作。
// 分「版本」「品相」两张卡，每张卡一行确认开关；照片分析依据折叠在摘要行下，可随时展开核对。
import type {ListingDraft} from '../../core/listing';
import {candidateText} from '../../core/listing';
import {Dropdown} from '../ui/Dropdown';
import './ListingReview.css';

type Props = {draft: ListingDraft; onChange: (draft: ListingDraft) => void};

function Confirm({on, onToggle, children}: {on: boolean; onToggle: (v: boolean) => void; children: string}) {
  return <label className={`listing-confirm${on ? ' is-on' : ''}`}>
    <input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)}/>
    <span>{children}</span><b aria-hidden="true">{on ? '已确认' : '待确认'}</b>
  </label>;
}

export function ListingReview({draft, onChange}: Props) {
  const analysis = draft.analysis;
  const change = (patch: Partial<ListingDraft>) => onChange({...draft, ...patch});
  return <div className="listing-review">
    {analysis ? <details className="listing-evidence" open>
      <summary>照片分析依据<small>标识 {analysis.identifiers.length} · 观察 {analysis.observations.length} · 待确认 {analysis.pending.length}</small></summary>
      {[...analysis.identifiers, ...analysis.observations].map((row, i) => <p key={i}>
        {row.text} <span className="small-note">（照片 {row.photos.map(n => n + 1).join('、')}）</span>
      </p>)}
      {analysis.pending.length ? <><strong>待确认 · 不写入文案</strong><ul>{analysis.pending.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}
      {analysis.catalogError ? <p role="status">发行资料查询未完成：{analysis.catalogError}</p> : null}
      {!analysis.candidates.length ? <p className="small-note">未找到可确认的发行版；可补拍标识，或手动填写已核对的信息。</p> : null}
    </details> : null}

    <section className="listing-card" aria-label="版本核对">
      <h4>版本</h4>
      {analysis?.candidates.length ? <>
        <Dropdown label="发行版本候选" value={draft.selectedRelease ?? ''}
          options={[{value: '', label: '请选择并核对，留空表示版本未确定'},
            ...analysis.candidates.map(row => ({value: row.id, label: candidateText(row)}))]}
          onPick={value => {const row = analysis.candidates.find(item => item.id === value);
            change({selectedRelease: value, versionText: row ? candidateText(row) : '', versionConfirmed: false});}}/>
        {draft.selectedRelease ? <a href={`https://musicbrainz.org/release/${encodeURIComponent(draft.selectedRelease)}`}
          target="_blank" rel="noopener noreferrer">查看版本资料 ↗</a> : null}
      </> : null}
      <label>版本说明<small>不确定的内容留空</small>
        <textarea value={draft.versionText} rows={2} maxLength={3000}
          onChange={e => change({versionText: e.target.value, versionConfirmed: false})}/></label>
      <Confirm on={draft.versionConfirmed} onToggle={v => change({versionConfirmed: v})}>已核对版本说明，未确定的信息已留空</Confirm>
    </section>

    <section className="listing-card" aria-label="品相核对">
      <h4>品相</h4>
      {analysis?.observations.length ? <button type="button" className="listing-adopt" onClick={() => change({
        conditionText: analysis.observations.map(row => row.text).join('\n'), conditionConfirmed: false})}>采用照片观察到的品相说明</button> : null}
      <label>品相说明<small>附件、外观瑕疵；不承诺能否播放</small>
        <textarea value={draft.conditionText} rows={3} maxLength={6000}
          onChange={e => change({conditionText: e.target.value, conditionConfirmed: false})}/></label>
      <Confirm on={draft.conditionConfirmed} onToggle={v => change({conditionConfirmed: v})}>已核对品相与附件；试听情况由我确认</Confirm>
    </section>
  </div>;
}
