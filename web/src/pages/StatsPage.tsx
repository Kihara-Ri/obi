// 账本页：利润卡（全部时间） → 钱压在哪（当前库存成本分段）→ 每月收支图 → 月度表。
// 计算全在 core/ledger.ts；本文件只负责按启用的模块取舍与排版。
import {useMemo} from 'react';
import {sum, yuan} from '../core/format';
import {avgTransitDays, ledgerMonths, ledgerSummary, signedYuan, stockBucket} from '../core/ledger';
import type {StockBucket} from '../core/ledger';
import {useApp} from '../state/AppContext';
import {PageHead} from '../components/PageHead';
import {DownloadButton} from '../components/DownloadButton';
import {LedgerChart} from './LedgerChart';
import {LedgerTable} from './LedgerTable';
import './StatsPage.css';

/** 小字说明：各段以「 · 」连接，每段整体换行 */
function Note({parts}: {parts: (string | number | false | null)[]}) {
  const shown = parts.filter((p): p is string => typeof p === 'string' && !!p);
  return shown.length ? <p className="ledger-note">{shown.map((p, i) => <span key={i}>{i ? '\u00a0· ' : ''}{p}</span>)}</p> : null;
}

interface Bucket {key: string; label: string; b: StockBucket; sub: (string | false)[]}

export function StatsPage() {
  const {state, modules} = useApp();
  const {trading, acquisition: acq, circulation} = modules;
  const months = useMemo(() => ledgerMonths(state.records, state.sales), [state.records, state.sales]);
  const t = ledgerSummary(months, state.sales);
  const shipping = state.sales.filter(s => s.status === 'shipping');
  const owed = sum(shipping.flatMap(s => s.items), 'net');

  const of = (st: string) => state.records.filter(r => r.status === st);
  const days = avgTransitDays(state.shipments);
  const buckets: Bucket[] = circulation ? [
    {key: 'ov', label: '海外库存', b: stockBucket(of('overseas')), sub: []},
    {key: 'tr', label: '海外在途', b: stockBucket(of('transit')),
     sub: [`${state.shipments.filter(s => s.status === 'transit').length} 个包裹`, '含运费', days !== null && `按往期平均 ${days} 天到`]},
    {key: 'dom', label: '国内库存', b: stockBucket(of('domestic')), sub: []},
  ] : [{key: 'dom', label: '收藏', b: stockBucket(state.records.filter(r => ['overseas', 'transit', 'domestic'].includes(r.status))), sub: []}];
  const total = buckets.reduce((a, x) => ({count: a.count + x.b.count, cost: a.cost + x.b.cost}), {count: 0, cost: 0});
  const weight = (x: Bucket) => acq ? x.b.cost : x.b.count;
  const whole = buckets.reduce((a, x) => a + weight(x), 0);

  return (
    <>
      <PageHead title="账本" desc={acq ? '人民币统一口径：日元按买入当天汇率折算。' : '按到账月份统计售出到手金额。'} label="IN NUMBERS"
                actions={<DownloadButton path="export" fileName="albums.csv" className="link-button head-text" ariaLabel="导出库存 CSV"><span className="btn-long">导出库存 CSV</span><span className="btn-short" aria-hidden="true">导出</span></DownloadButton>}/>
      <div className="ledger-top">
        {trading ? <section className="ledger-card ledger-hero">
          <span className="ledger-label">{acq ? '已实现利润' : '售出到手'}</span>
          <strong className={'ledger-big' + (acq ? t.profit < 0 ? ' negative' : ' positive' : '')}>{yuan(acq ? t.profit : t.net)}</strong>
          <div className="ledger-row">
            {acq ? <div><span className="ledger-label">售出到手</span><b>{yuan(t.net)}</b></div>
                 : <div><span className="ledger-label">售出</span><b>{t.sold} 张</b></div>}
            {acq ? <div><span className="ledger-label">利润率</span><b>{t.margin === null ? '—' : `${(t.margin * 100).toFixed(1)}%`}</b></div> : null}
            <div><span className="ledger-label">退货损失</span><b className={t.loss < 0 ? 'negative' : ''}>{t.loss ? signedYuan(t.loss) : '—'}</b></div>
          </div>
          <Note parts={[`已确认收货 ${t.sold} 张`, acq && t.unknown ? `其中 ${t.unknown} 张成本待补，未计入利润` : false,
                        acq && t.returned ? `已扣 ${t.returned} 笔退货` : false,
                        shipping.length ? `另有售出中应收 ${yuan(owed)}（${shipping.length} 笔）` : false]}/>
        </section> : null}
        <section className="ledger-card ledger-stock" aria-label={acq ? '钱压在哪' : '库存'}>
          <div className="ledger-stock-head">
            <span className="ledger-label">{acq ? `钱压在哪 · ${total.count} 张` : '库存'}</span>
            <b>{acq ? yuan(total.cost) : `${total.count} 张`}</b>
          </div>
          {buckets.length > 1 && whole > 0 ? <div className="ledger-bar" aria-hidden="true">
            {buckets.map(x => weight(x) ? <i key={x.key} className={'is-' + x.key} style={{flexGrow: weight(x)}}/> : null)}
          </div> : null}
          <ul className="ledger-legend">
            {buckets.map(x => (
              <li key={x.key}>
                {buckets.length > 1 ? <span className={'ledger-dot is-' + x.key}/> : null}
                <span>{x.label} · {x.b.count} 张</span>
                {acq ? <b>{yuan(x.b.cost)}</b> : null}
                <Note parts={[...x.sub, trading && x.b.listed ? `已上架 ${x.b.listed} 张` : false,
                              acq && x.b.unknown ? `${x.b.unknown} 张成本待补` : false]}/>
              </li>
            ))}
          </ul>
          {acq ? <Note parts={['按成本计，日元按买入当天汇率']}/> : null}
        </section>
      </div>
      {months.length ? <>
        <h3 className="section-title">每月收支</h3>
        <LedgerChart months={months} buy={acq} sell={trading} profit={acq && trading} showYear/>
        <LedgerTable months={months} total={t} buy={acq} sell={trading} profit={acq && trading} showYear/>
      </> : <p className="help">还没有买入或售出记录。</p>}
    </>
  );
}
