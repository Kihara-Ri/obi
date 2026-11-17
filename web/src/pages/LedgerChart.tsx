// 账本「每月收支」柱状图：每月一组柱子（灰 = 买入支出，主色 = 售出到手），上方标当月利润。
// 旧的在左、新的在右；一屏约 6 个月，更多时横向滑动，打开时停在最新的月份。
import {useLayoutEffect, useRef} from 'react';
import type {LedgerMonth} from '../core/ledger';
import './LedgerChart.css';

interface Props {
  months: LedgerMonth[];
  buy: boolean;
  sell: boolean;
  profit: boolean;
  /** 跨年展示时在每年第一个月下面标年份 */
  showYear: boolean;
}

const BAR_MAX = 100;   // 最高柱子的像素高度（与 LedgerChart.css 的 .ledger-chart-plot 高度配套）

const short = (v: number): string => {
  const a = Math.abs(Math.round(v));
  return (v > 0 ? '+' : v < 0 ? '−' : '') + (a >= 10000 ? `${(a / 10000).toFixed(1)}万` : String(a));
};

export function LedgerChart({months, buy, sell, profit, showYear}: Props) {
  const list = [...months].reverse();
  const scroller = useRef<HTMLDivElement>(null);
  const top = Math.max(1, ...list.map(m => Math.max(buy ? m.buy : 0, sell ? m.net : 0)));
  const h = (v: number) => v > 0 ? Math.max(2, Math.round(v / top * BAR_MAX)) : 0;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [months]);

  return (
    <section className="ledger-card ledger-chart" aria-label="每月收支图">
      <div className="ledger-chart-scroll" ref={scroller}>
        <div className="ledger-chart-plot">
          {list.map((m, i) => {
            const mm = Number(m.key.slice(5, 7));
            const yearMark = showYear && (i === 0 || m.key.slice(0, 4) !== list[i - 1].key.slice(0, 4));
            return (
              <div className="ledger-chart-col" key={m.key}>
                {profit && (m.sold || m.returned) ? <span className={'ledger-chart-pv' + (m.profit < 0 ? ' negative' : m.profit > 0 ? ' positive' : '')}>{short(m.profit)}</span> : null}
                <div className="ledger-chart-bars">
                  {buy ? <i className="is-buy" style={{height: h(m.buy)}}/> : null}
                  {sell ? <i className="is-net" style={{height: h(m.net)}}/> : null}
                </div>
                <span className="ledger-chart-x">{mm}月{yearMark ? <small>{m.key.slice(0, 4)}</small> : null}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ledger-chart-key">
        {buy ? <span><i className="is-buy"/>买入支出</span> : null}
        {sell ? <span><i className="is-net"/>售出到手</span> : null}
        {profit ? <span className="positive">+N 当月利润</span> : null}
      </div>
    </section>
  );
}
