// 发行版检索区块：一个输入框（自动识别条码 / 唱片编号，与「查询」页同一套识别）+ 一条状态行 + 候选卡片 / 已确认摘要。
// 条码与唱片编号只在这里编辑，「发行资料」折叠区不再重复提供；状态一律走 phase，文案保持一行。
import {useState} from 'react';
import {FocusInput} from '../../components/ui/FocusInput';
import {BarcodeScanner, ScanField} from '../../components/BarcodeScanner';
import {ReleaseCandidateCard, ReleaseSummary, sourceName} from '../../components/ReleaseCandidateCard/ReleaseCandidateCard';
import {CoverPanel} from './CoverPanel';
import type {CoverSearch} from './useCoverSearch';
import type {RecordValues} from './context';
import type {ReleaseLookup} from './useReleaseLookup';
import './ReleaseLookupSection.css';

type Phase = 'idle' | 'busy' | 'choose' | 'ok' | 'miss' | 'manual';
const MARK: Record<Phase, string> = {idle: '!', busy: '', choose: '', ok: '✓', miss: '!', manual: '✎'};
// 只含数字、空格、连字符的输入按条码处理，其余按唱片编号（与 core/lookup 的 classify 一致）
const kindOf = (raw: string) => /^[\d\s-]*$/.test(raw) ? 'barcode' : 'catalog';

/** 当前这张的信息卡（封面、版本资料、换封面都在这一张卡里，表单不再单独放封面区块）；
 * 正在从候选里选版本时隐藏，免得与候选卡重复。 */
const summaryShown = (v: RecordValues, L: ReleaseLookup) =>
  !!(v.title && v.artist) && !L.candidates.length;

export function ReleaseLookupSection({v, lookup: L, cover, coverSrc}: {
  v: RecordValues; lookup: ReleaseLookup; cover: CoverSearch; coverSrc: string;
}) {
  const info = v.releaseInfo;
  const [typed, setTyped] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
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
  const scanned = (code: string) => {
    setScanning(false); setEditing(false); change(code); void L.search('barcode', code);
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
        <ScanField onScan={() => setScanning(true)}>
          <button type="button" id="record-lookup" className={'lookup-field' + (text ? '' : ' is-empty')} onClick={() => setEditing(true)}>
            {text || '条形码，或唱片编号如 AMCY-2434'}
          </button>
        </ScanField>
        <button type="button" className="primary" onClick={() => void L.lookup()} disabled={working}>查询</button>
      </div>
      {status ? <p className={`lookup-status is-${phase}`} role="status">
        {phase === 'busy' ? <span className="lookup-spinner" aria-hidden="true"/> : <b aria-hidden="true">{phase === 'choose' ? L.candidates.length : MARK[phase]}</b>}
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
      {summaryShown(v, L) ? <div className="rcc is-confirmed">
        <ReleaseSummary title={v.title} artist={v.artist} info={info} art={coverSrc}
          source={confirmed ? sourceName(info) : L.manualRelease ? '手动' : '未确认'}
          url={confirmed ? (info.musicBrainzReleaseId ? 'https://musicbrainz.org/release/' + info.musicBrainzReleaseId
            : 'https://www.discogs.com/release/' + info.discogsReleaseId) : undefined}/>
        <CoverPanel cover={cover} src={coverSrc} busy={cover.busy} inline/>
      </div> : null}
          <FocusInput open={editing} title="查询发行版" value={text} placeholder="条形码，或唱片编号如 AMCY-2434"
        submitLabel="查询" onChange={change} onSubmit={submit} onClose={() => setEditing(false)}/>
    {scanning ? <BarcodeScanner onDetect={scanned} onClose={() => setScanning(false)}/> : null}
    </section>
  );
}
