// 发行版检索区块：只有一个检索入口（条码 / 编号切换）+ 一条状态行 + 候选 / 已确认摘要。
// 条码与唱片编号只在这里编辑，「发行资料」折叠区不再重复提供；状态一律走 phase，文案保持一行。
import {Seg} from '../../components/ui/Seg';
import {dedupeCatalog} from '../../core/release-metadata';
import type {RecordValues} from './context';
import type {LookupMode, ReleaseLookup} from './useReleaseLookup';

type Phase = 'idle' | 'busy' | 'choose' | 'ok' | 'miss' | 'manual';
const MARK: Record<Phase, string> = {idle: '!', busy: '', choose: '…', ok: '✓', miss: '!', manual: '✎'};

export function ReleaseLookupSection({v, lookup: L}: {v: RecordValues; lookup: ReleaseLookup}) {
  const info = v.releaseInfo;
  const enter = (e: React.KeyboardEvent) => {if (e.key === 'Enter') {e.preventDefault(); void L.lookup();}};
  const source = info.discogsReleaseId && !info.musicBrainzReleaseId ? 'Discogs' : 'MusicBrainz';
  const confirmed = !!(info.musicBrainzReleaseId || info.discogsReleaseId);
  const working = L.busy || L.verification === 'pending';
  const phase: Phase = working ? 'busy' : L.candidates.length ? 'choose' : L.notFound ? 'miss'
    : L.manualRelease ? 'manual' : confirmed && L.verification === 'verified' ? 'ok' : 'idle';
  const text = phase === 'ok' ? `已确认 · ${source}` : L.message
    || (phase === 'manual' ? '手动录入 · 未经资料库核对' : v.title && !confirmed ? '尚未确认发行版' : '');
  return (
    <section className="record-barcode-entry form-section">
      <div className="lookup-head">
        <label htmlFor={L.mode === 'barcode' ? 'record-barcode' : 'record-catalog-number'}>发行版</label>
        <Seg ariaLabel="检索方式" value={L.mode} onValue={mode => L.setMode(mode as LookupMode)}
          options={[{value: 'barcode', label: '条码'}, {value: 'catalog', label: '编号'}]}/>
      </div>
      <div className="record-barcode-row">
        {L.mode === 'barcode'
          ? <input id="record-barcode" type="text" inputMode="numeric" autoComplete="off"
              placeholder="CD 背面的条形码" value={L.barcode}
              onChange={e => L.changeBarcode(e.target.value)} onKeyDown={enter}/>
          : <input id="record-catalog-number" type="text" autoComplete="off"
              placeholder="如 AMCY-2434" value={L.catalogNumber}
              onChange={e => L.changeCatalogNumber(e.target.value)} onKeyDown={enter}/>}
        <button type="button" className="primary" onClick={() => void L.lookup()} disabled={working}>查询</button>
      </div>
      {text ? <p className={`lookup-status is-${phase}`} role="status">
        {phase === 'busy' ? <span className="lookup-spinner" aria-hidden="true"/> : <b aria-hidden="true">{MARK[phase]}</b>}
        <span>{text}</span>
        {phase === 'miss' && !L.manualRelease
          ? <button type="button" className="quiet" onClick={L.enterManually}>手动录入</button> : null}
      </p> : null}
      {L.candidates.length ? <ul className="release-candidates" aria-label="选择发行版本">
        {L.candidates.map(c => <li key={c.id}>
          <button type="button" disabled={L.busy} onClick={() => void L.chooseRelease(c)}>
            <span className="rc-main"><strong>{c.title}</strong><span>{c.artist}</span></span>
            <span className="rc-chips">
              {[c.releaseInfo.country || '地区未知', c.releaseInfo.releaseDate || '日期未知', dedupeCatalog(c.releaseInfo.catalogNumber),
                c.source === 'discogs' ? 'Discogs' : ''].filter(Boolean).map(t => <span key={t} className="rc-chip">{t}</span>)}
            </span>
          </button>
        </li>)}
      </ul> : null}
      {v.title && v.artist && (confirmed || L.manualRelease) ? <div className="release-card">
        <div className="rc-head">
          <div className="rc-main"><strong>{v.title}</strong><span>{v.artist}</span></div>
          {confirmed
            ? <a className="rc-source" href={info.musicBrainzReleaseId ? 'https://musicbrainz.org/release/' + info.musicBrainzReleaseId
                : 'https://www.discogs.com/release/' + info.discogsReleaseId}
                target="_blank" rel="noopener noreferrer" aria-label={`在 ${source} 查看发行资料`}>{source} ↗</a>
            : <span className="rc-chip">手动</span>}
        </div>
        {confirmed ? <dl className="rc-meta">
          <div><dt>地区</dt><dd>{info.country || '—'}</dd></div>
          <div><dt>发行日</dt><dd>{info.releaseDate || '—'}</dd></div>
          {dedupeCatalog(info.catalogNumber) ? <div><dt>编号</dt><dd>{dedupeCatalog(info.catalogNumber)}</dd></div> : null}
          {info.barcode ? <div><dt>条码</dt><dd>{info.barcode}</dd></div> : null}
        </dl> : null}
      </div> : null}
    </section>
  );
}
