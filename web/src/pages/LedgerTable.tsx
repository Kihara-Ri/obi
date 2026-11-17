// 账本月度表：一行一个月（买入 / 到手 / 利润），月份下一行小字写张数、退货与待补，底部合计。
import {fmtMonth, yuan} from '../core/format';
import {signedYuan} from '../core/ledger';
import type {LedgerMonth, LedgerSummary} from '../core/ledger';
import './LedgerTable.css';

interface Props {
  months: LedgerMonth[];
  total: LedgerSummary;
  buy: boolean;
  sell: boolean;
  profit: boolean;
  showYear: boolean;
}

const tone = (v: number) => v < 0 ? 'negative' : v > 0 ? 'positive' : '';

function detail(m: LedgerMonth, buy: boolean, sell: boolean, profit: boolean): string {
  const parts: string[] = [];
  if (sell && m.sold) parts.push(`卖 ${m.sold}`);
  if (buy && m.buyCount) parts.push(`买 ${m.buyCount}`);
  if (sell && m.returned) parts.push(`退货 ${m.returned}`);
  if (buy && m.buyUnknown) parts.push(`${m.buyUnknown} 张成本待补`);
  if (profit && m.unknown) parts.push(`${m.unknown} 张未计利润`);
  return parts.join(' · ');
}

export function LedgerTable({months, total, buy, sell, profit, showYear}: Props) {
  return (
    <section className="ledger-card ledger-table-card">
      <table className="ledger-table">
        <thead>
          <tr><th>月份</th>{buy ? <th>买入</th> : null}{sell ? <th>到手</th> : null}{profit ? <th>利润</th> : null}</tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m.key}>
              <td>
                <span className="ledger-month">{showYear ? fmtMonth(m.key) : `${Number(m.key.slice(5, 7))}月`}</span>
                <small>{detail(m, buy, sell, profit)}</small>
              </td>
              {buy ? <td>{m.buyCount ? yuan(m.buy) : '—'}</td> : null}
              {sell ? <td>{m.sold ? yuan(m.net) : '—'}</td> : null}
              {profit ? <td className={tone(m.profit)}>{m.sold || m.returned ? signedYuan(m.profit) : '—'}</td> : null}
            </tr>
          ))}
        </tbody>
        {months.length > 1 ? <tfoot>
          <tr>
            <td>合计</td>
            {buy ? <td>{yuan(total.buy)}</td> : null}
            {sell ? <td>{yuan(total.net)}</td> : null}
            {profit ? <td className={tone(total.profit)}>{signedYuan(total.profit)}</td> : null}
          </tr>
        </tfoot> : null}
      </table>
    </section>
  );
}
