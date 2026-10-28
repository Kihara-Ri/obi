// 发行版检索区块：一个输入框（自动识别条码 / 唱片编号，与「查询」页同一套识别）+ 一条状态行 + 候选卡片 / 已确认摘要。
// 条码与唱片编号只在这里编辑，「发行资料」折叠区不再重复提供；状态一律走 phase，文案保持一行。
import {useEffect, useRef, useState} from 'react';
import {barcodeFromPhotos} from '../../core/photo-barcode';
import {FocusInput} from '../../components/ui/FocusInput';
import {BarcodeScanner, ScanField} from '../../components/BarcodeScanner';
import {ReleaseCandidateCard, ReleaseSummary, sourceName} from '../../components/ReleaseCandidateCard/ReleaseCandidateCard';
import type {CoverOrigin} from '../../core/version-cover';
import {boundSource, sourceUrl} from '../../core/release-source';
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
const working0 = (L: ReleaseLookup) => L.busy || L.verification === 'pending';
const summaryShown = (v: RecordValues, L: ReleaseLookup) =>
  !!(v.title && v.artist) && !L.candidates.length;

export function ReleaseLookupSection({v, lookup: L, cover, coverSrc, coverOrigin, photoSources = [], canLeaveManual}: {
  v: RecordValues; lookup: ReleaseLookup; cover: CoverSearch; coverSrc: string; coverOrigin?: CoverOrigin | null;
  /** 已就绪的实物照片（key 标识同一张，src 可直接加载）；条码为空时自动从中识别 */
  /** 新增时手动录入可退回查询；编辑已有记录不提供，避免改动既有标记 */
  canLeaveManual?: boolean;
  photoSources?: {key: string; src: string}[];
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
  // 从照片识别条码：条码还是空时，新就绪的照片自动识别（引擎已自动读取，不再提供手动按钮）
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState('');
  const seen = useRef(new Set<string>());
  const readPhotos = async () => {
    const list = photoSources.filter(p => !seen.current.has(p.key));
    list.forEach(p => seen.current.add(p.key));
    if (!list.length) return;
    setReading(true); setReadMsg('');
    const code = await barcodeFromPhotos(list.map(p => p.src));
    setReading(false);
    if (code) { setReadMsg(`已从照片识别条码 ${code}`); scanned(code); }
  };
  // 从详情里识别出的条码：表单一打开就带着它查询（先于照片自动识别）
  const barcodeEmpty = !text && !working0(L);
  const sourceKeys = photoSources.map(p => p.key).join(',');
  useEffect(() => { if (barcodeEmpty && !reading) void readPhotos(); }, [sourceKeys, barcodeEmpty]);
  // 点「手动录入 / 改回查询」先播一段退场动画再切换状态（时长与 .lookup-out 一致）
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const afterExit = (go: () => void) => { setLeaving(true); timer.current = window.setTimeout(() => { setLeaving(false); go(); }, 160); };
  const confirmed = !!boundSource(info);
  const working = L.busy || L.verification === 'pending';
  const phase: Phase = working ? 'busy' : L.candidates.length ? 'choose' : L.notFound ? 'miss'
    : L.manualRelease ? 'manual' : confirmed && L.verification === 'verified' ? 'ok' : 'idle';
  const link = sourceUrl(info);
  // 已确认：来源链接只在这一行出现（摘要头部不再重复一个来源标）
  const status = phase === 'ok' ? <>已确认 · <a className="lookup-source" href={link} target="_blank" rel="noopener noreferrer"
    aria-label={`在 ${sourceName(info)} 查看`}>{sourceName(info)} ↗</a></> : L.message
    || (phase === 'manual' ? (info.unofficial === '1' ? '非官方发行 · 未经资料库核对' : '手动录入 · 未经资料库核对') : v.title && !confirmed ? '尚未确认发行版' : '');
  return (
    <section className="record-barcode-entry form-section">
      <label className="lookup-label" htmlFor="record-lookup">发行版</label>
      <div className="record-barcode-row">
        <ScanField onScan={() => setScanning(true)}>
          <button type="button" id="record-lookup" className={'lookup-field' + (text ? '' : ' is-empty')} onClick={() => setEditing(true)}>
            {text || '条形码，或唱片编号如 AMCY-2434'}
          </button>
        </ScanField>
        <button type="button" className="primary" aria-busy={working} onClick={() => void L.lookup()} disabled={working}>查询</button>
      </div>
      {readMsg ? <p className="lookup-photo-read"><span role="status">{readMsg}</span></p> : null}
      {status ? <p className={`lookup-status is-${phase}` + (leaving ? ' is-leaving' : '')} role="status">
        {phase === 'busy' ? <span className="lookup-spinner" aria-hidden="true"/> : <b aria-hidden="true">{phase === 'choose' ? L.candidates.length : MARK[phase]}</b>}
        <span>{status}</span>
        {phase === 'miss' && !L.manualRelease ? <span className="lookup-miss-actions">
          <button type="button" className="quiet" onClick={() => L.setUnofficial(true)}>非官方发行</button>
          <button type="button" onClick={L.enterManually}>按未收录版本录入</button></span> : null}
        {phase === 'manual' && canLeaveManual ? <button type="button" className="lookup-leave-manual" disabled={leaving} onClick={() => afterExit(L.leaveManual)}>改回查询</button> : null}
      </p> : null}
      {/* 没有条码 / 编号时不会进入「查不到」状态，入口常驻，不等查询失败 */}
      {!working && !L.manualRelease && !confirmed && !v.title && !L.candidates.length && phase !== 'miss' ?
        <button type="button" className={'lookup-manual-entry' + (leaving ? ' is-leaving' : '')} disabled={leaving}
          onClick={() => afterExit(L.enterManually)}>
          <span>没有条码或编号？<b>按未收录版本手动录入</b></span><i aria-hidden="true">›</i>
        </button> : null}
      {L.candidates.length ? <ul className="release-candidates" aria-label="选择发行版本">
        {L.candidates.map(c => <ReleaseCandidateCard key={c.id} c={c} fold>{() =>
          <button type="button" className="primary rcc-add" disabled={L.busy} onClick={() => void L.chooseRelease(c)}>
            选用此版本
          </button>}</ReleaseCandidateCard>)}
      </ul> : null}
      {summaryShown(v, L) ? <div className="rcc is-confirmed">
        <ReleaseSummary title={v.title} artist={v.artist} info={info} art={coverSrc} origin={coverOrigin}
          source={phase === 'ok' ? undefined : confirmed ? sourceName(info) : info.unofficial === '1' ? '非官方' : L.manualRelease ? '手动' : '未确认'}
          url={confirmed ? link : undefined}/>
        <CoverPanel cover={cover} src={coverSrc} busy={cover.busy} inline/>
      </div> : null}
          <FocusInput open={editing} title="查询发行版" value={text} placeholder="条形码，或唱片编号如 AMCY-2434"
        submitLabel="查询" onChange={change} onSubmit={submit} onClose={() => setEditing(false)}/>
    {scanning ? <BarcodeScanner onDetect={scanned} onClose={() => setScanning(false)}/> : null}
    </section>
  );
}
