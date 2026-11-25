// 发行版检索区块：一个输入框（自动识别条码 / 唱片编号，与「查询」页同一套识别）+ 一条状态行（检索中换成与查询页同款的进度卡）+ 候选卡片 / 已确认摘要。
// 条码与唱片编号只在这里编辑，「发行资料」折叠区不再重复提供；状态一律走 phase，文案保持一行。
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {barcodeFromPhotos} from '../../core/photo-barcode';
import {Chevron} from '../../components/ui/Chevron';
import {Collapse} from '../../components/ui/Collapse';
import {FocusInput} from '../../components/ui/FocusInput';
import {BarcodeScanner, ScanField} from '../../components/BarcodeScanner';
import {ReleaseCandidateCard, ReleaseSummary, sourceName} from '../../components/ReleaseCandidateCard/ReleaseCandidateCard';
import type {CoverOrigin} from '../../core/version-cover';
import {boundSource, sourceUrl} from '../../core/release-source';
import {classify, lookupSources} from '../../core/lookup';
import {MEDIA, MEDIUM_LABEL, isMedium} from '../../core/medium';
import {Seg} from '../../components/ui/Seg';
import {LookupProgress} from '../../components/LookupProgress/LookupProgress';
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

function BarcodeMiss({message, statusId, manualActions}: {
  message: string; statusId: string; manualActions: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <>
      <p className="lookup-status is-miss">
        <b aria-hidden="true">{MARK.miss}</b>
        <span id={statusId} role="status">{message}</span>
        {manualActions ? <button type="button" className="quiet lookup-unlisted-toggle"
          aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(open => !open)}>
          未收录版本<Chevron/>
        </button> : null}
      </p>
      {manualActions ? <Collapse open={expanded} id={id} className="lookup-unlisted-options">{manualActions}</Collapse> : null}
    </>
  );
}

export function ReleaseLookupSection({v, lookup: L, cover, coverSrc, coverOrigin, photoSources = [], canLeaveManual}: {
  v: RecordValues; lookup: ReleaseLookup; cover: CoverSearch; coverSrc: string; coverOrigin?: CoverOrigin | null;
  /** 已就绪的实物照片（key 标识同一张，src 可直接加载）；条码为空时自动从中识别 */
  /** 新增时手动录入可退回查询；编辑已有记录不提供，避免改动既有标记 */
  canLeaveManual?: boolean;
  photoSources?: {key: string; src: string}[];
}) {
  const info = v.releaseInfo;
  const [typed, setTyped] = useState<string | null>(null);
  const [editor, setEditor] = useState<{kind: 'lookup'} | {kind: 'retry'; draft: string} | null>(null);
  const lookupField = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const [scanning, setScanning] = useState(false);
  const retryDraft = editor?.kind === 'retry' ? editor.draft : null;
  // 没动过输入框时显示当前模式对应的值（编辑旧记录：条码优先，只有编号时显示编号）
  const text = typed ?? (L.mode === 'barcode' ? L.barcode : L.catalogNumber);
  const change = (raw: string) => {
    setTyped(raw);
    const kind = kindOf(raw);
    if (kind !== L.mode) L.setMode(kind);
    if (kind === 'barcode') L.changeBarcode(raw); else L.changeCatalogNumber(raw);
  };
  const closeEditor = () => {
    setEditor(null);
    if (retryDraft !== null) lookupField.current?.focus({preventScroll: true});
  };
  // 提交后收起输入层，把输入框那一行滚到内容区顶部，下面的状态 / 候选随即可见
  const submit = () => {
    const replacement = retryDraft?.trim();
    if (retryDraft !== null && !replacement) return;
    setEditor(null);
    if (replacement) {
      const result = classify(replacement);
      if (result.ok && result.kind === 'barcode') {
        change(result.value);
        void L.search('barcode', result.value);
      } else {
        // 保留原发行资料，等用户选定候选才应用编号查询的结果。
        setTyped(replacement);
        L.setMode('catalog');
        L.setCatalogNumber(replacement);
        void L.search('catalog', replacement);
      }
    } else {
      void L.lookup();
    }
    window.setTimeout(() => document.getElementById('record-lookup')?.scrollIntoView({block: 'start', behavior: 'smooth'}), 120);
  };
  const scanned = (code: string) => {
    setScanning(false); setEditor(null); change(code); void L.search('barcode', code);
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
  const phase: Phase = working ? 'busy' : L.candidates.length ? 'choose' : L.miss ? 'miss'
    : L.manualRelease ? 'manual' : confirmed && L.verification === 'verified' ? 'ok' : 'idle';
  const barcodeMiss = phase === 'miss' && L.miss === 'barcode';
  const openEditor = () => {
    const retry = barcodeMiss || (L.miss === 'catalog' && !L.manualRelease);
    flushSync(() => setEditor(retry ? {kind: 'retry', draft: barcodeMiss ? '' : text} : {kind: 'lookup'}));
  };
  const manualActions = phase === 'miss' && !L.manualRelease ? <span className="lookup-miss-actions">
    <button type="button" className={barcodeMiss ? undefined : 'quiet'} onClick={() => L.setUnofficial(true)}>非官方发行</button>
    <button type="button" onClick={L.enterManually}>按未收录版本录入</button>
  </span> : null;
  const link = sourceUrl(info);
  // 已确认：来源链接只在这一行出现（摘要头部不再重复一个来源标）
  const status = phase === 'ok' ? <>已确认 · <a className="lookup-source" href={link} target="_blank" rel="noopener noreferrer"
    aria-label={`在 ${sourceName(info)} 查看`}>{sourceName(info)} ↗</a></> : L.message
    || (phase === 'manual' ? (info.unofficial === '1' ? '非官方发行 · 未经资料库核对' : '手动录入 · 未经资料库核对') : v.title && !confirmed ? '尚未确认发行版' : '');
  return (
    <section className="record-barcode-entry form-section">
      <div className="lookup-head">
        <label className="lookup-label" htmlFor="record-lookup">发行版</label>
        {/* 先选介质再查：查询、核对、封面都按它找；已确认版本后由版本资料决定，不再显示 */}
        {!confirmed ? <Seg className="seg-medium" ariaLabel="介质" value={L.medium} disabled={working}
          options={MEDIA.map(m => ({value: m, label: MEDIUM_LABEL[m]}))}
          onValue={m => { if (isMedium(m)) L.setMedium(m); }}/> : null}
      </div>
      <div className="record-barcode-row" data-error-anchor>
        <ScanField onScan={() => setScanning(true)}>
          <button type="button" id="record-lookup" ref={lookupField} aria-describedby={barcodeMiss ? hintId : undefined}
            className={'lookup-field' + (text ? '' : ' is-empty')} onClick={openEditor}>
            {text || '条码或唱片编号'}
          </button>
        </ScanField>
        <button type="button" className="primary" aria-busy={working} onClick={() => void L.lookup()} disabled={working}>查询</button>
      </div>
      {readMsg ? <p className="lookup-photo-read"><span role="status">{readMsg}</span></p> : null}
      {L.searching ? <LookupProgress sources={lookupSources(L.searching, L.medium)} onCancel={L.cancelSearch}/> : null}
      {barcodeMiss ? <BarcodeMiss message={L.message} statusId={hintId} manualActions={manualActions}/>
        : status && !L.searching ? <p className={`lookup-status is-${phase}` + (leaving ? ' is-leaving' : '')}>
        {phase === 'busy' ? <span className="lookup-spinner" aria-hidden="true"/> : <b aria-hidden="true">{phase === 'choose' ? L.candidates.length : MARK[phase]}</b>}
        <span role="status">{status}</span>
        {manualActions}
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
      <FocusInput open={editor !== null} title="查询发行版"
        value={retryDraft ?? text} placeholder={retryDraft === null ? '条码或唱片编号' : '唱片编号'}
        submitLabel="查询" onChange={retryDraft === null ? change : draft => setEditor({kind: 'retry', draft})}
        onSubmit={submit} onClose={closeEditor}/>
      {scanning ? <BarcodeScanner onDetect={scanned} onClose={() => setScanning(false)}/> : null}
    </section>
  );
}
