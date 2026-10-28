// 自动核对摘要；不再逐项勾选，异常提示与可追溯的照片依据分开呈现。
import type {ListingDraft} from '../../core/listing';
import {Details} from '../ui/Details';
import './ListingReview.css';

export function ListingReview({draft, onReanalyze}: {draft: ListingDraft; onReanalyze?: () => void}) {
  const analysis = draft.analysis;
  if (!analysis) return null;
  const pending = [...(analysis.conflicts ?? []), ...analysis.pending];
  return <section className="listing-review" aria-label="实物核对摘要">
    <div className="listing-card">
      <h4>实物核对</h4>
      {draft.versionText ? <p className="note-text">{draft.versionText}</p> : null}
      <p className="note-text">{draft.conditionText || '实物品相尚未核实'}</p>
      {pending.length ? <Details key={JSON.stringify(analysis.conflicts ?? [])} summary={`待核实 · ${pending.length} 项`} defaultOpen={!!analysis.conflicts?.length}>
        <ul>{pending.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </Details> : null}
      <Details summary="分析依据">
        {[...analysis.identifiers, ...analysis.observations].map((row, i) => <p key={i}>
          {row.text} <span className="small-note">（照片 {row.photos.map(n => n + 1).join('、')}）</span>
        </p>)}
        {!analysis.observations.length ? <p className="small-note">未使用照片观察；实物说明来自已有记录及本次补充。</p> : null}
        {draft.generation ? <p className="small-note">文案预设：{draft.generation.presetName}</p> : null}
        {onReanalyze ? <button type="button" onClick={onReanalyze}>重新核对并生成</button> : null}
      </Details>
    </div>
  </section>;
}
