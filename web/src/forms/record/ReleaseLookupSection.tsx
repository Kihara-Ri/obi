// 发行版检索区块：一个输入框（自动识别条码 / 唱片编号，与「查询」页同一套识别）+ 一条状态行 + 候选卡片 / 已确认摘要。
// 条码与唱片编号只在这里编辑，「发行资料」折叠区不再重复提供；状态一律走 phase，文案保持一行。
import {useState} from 'react';
import {FocusInput} from '../../components/ui/FocusInput';
import {ReleaseCandidateCard, ReleaseSummary, sourceName} from '../../components/ReleaseCandidateCard/ReleaseCandidateCard';
import type {RecordValues} from './context';
import type {ReleaseLookup} from './useReleaseLookup';
import './ReleaseLookupSection.css';

type Phase = 'idle' | 'busy' | 'choose' | 'ok' | 'miss' | 'manual';
const MARK: Record<Phase, string> = {idle: '!', busy: '', choose: '…', ok: '✓', miss: '!', manual: '✎'};
// 只含数字、空格、连字符的输入按条码处理，其余按唱片编号（与 core/lookup 的 classify 一致）
const kindOf = (raw: string) => /^[\d\s-]*$/.test(raw) ? 'barcode' : 'catalog';

export function ReleaseLookupSection({v, lookup: L}: {v: RecordValues; lookup: ReleaseLookup}) {
  const info = v.releaseInfo;
  const [typed, setTyped] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // 没动过输入框时显示当前模式对应的值（编辑旧记录：条码优先，只有编号时显示编号）
  const text = typed ?? (L.mode === 'barcode' ? L.barcode : L.catalogNumber);
  const change = (raw: string) => {
    setTyped(raw);
    const kind = kindOf(raw);
    if (kind !== L.mode) L.setMode(kind);
    if (kind === 'barcode') L.changeBarcode(raw); else L.changeCatalogNumber(raw);
  };
  // 提交后收起输入层，把输入框那一行滚到内容区顶部，下面的状态 / 候选随即可见
  const submit = () => {
    setEditing(false); void L.lookup();
    window.setTimeout(() => document.getElementById('record-lookup')?.scrollIntoView({block: 'start', behavior: 'smooth'}), 120);
  };
  const confirmed = !!(info.musicBrainzReleaseId || info.discogsReleaseId);
  const working = L.busy || L.verification === 'pending';
  const phase: Phase = working ? 'busy' : L.candidates.length ? 'choose' : L.notFound ? 'miss'
    : L.manualRelease ? 'manual' : confirmed && L.verification === 'verified' ? 'ok' : 'idle';
  const status = phase === 'ok' ? `已确认 · ${sourceName(info)}` : L.message
    || (phase === 'manual' ? '手动录入 · 未经资料库核对' : v.title && !confirmed ? '尚未确认发行版' : '');
  return (
    <section className="record-barcode-entry form-section">
      <label className="lookup-label" htmlFor="record-lookup">发行版</label>
      <div className="record-barcode-row">
        <button type="button" id="record-lookup" className={'lookup-field' + (text ? '' : ' is-empty')} onClick={() => setEditing(true)}>
          {text || '条形码，或唱片编号如 AMCY-2434'}
        </button>
        <button type="button" className="primary" onClick={() => void L.lookup()} disabled={working}>查询</button>
      </div>
      {status ? <p className={`lookup-status is-${phase}`} role="status">
        {phase === 'busy' ? <span className="lookup-spinner" aria-hidden="true"/> : <b aria-hidden="true">{MARK[phase]}</b>}
        <span>{status}</span>
        {phase === 'miss' && !L.manualRelease
          ? <button type="button" className="quiet" onClick={L.enterManually}>手动录入</button> : null}
      </p> : null}
      {L.candidates.length ? <ul className="release-candidates" aria-label="选择发行版本">
        {L.candidates.map(c => <ReleaseCandidateCard key={c.id} c={c}>{() =>
          <button type="button" className="primary rcc-add" disabled={L.busy} onClick={() => void L.chooseRelease(c)}>
            选用此版本
          </button>}</ReleaseCandidateCard>)}
      </ul> : null}
      {v.title && v.artist && (confirmed || L.manualRelease) ? <div className="rcc is-confirmed">
        <ReleaseSummary title={v.title} artist={v.artist} info={info}
          source={confirmed ? sourceName(info) : '手动'}
          url={confirmed ? (info.musicBrainzReleaseId ? 'https://musicbrainz.org/release/' + info.musicBrainzReleaseId
            : 'https://www.discogs.com/release/' + info.discogsReleaseId) : undefined}/>
      </div> : null}
          <FocusInput open={editing} title="查询发行版" value={text} placeholder="条形码，或唱片编号如 AMCY-2434"
        submitLabel="查询" onChange={change} onSubmit={submit} onClose={() => setEditing(false)}/>
    </section>
  );
}
