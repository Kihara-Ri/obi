// 打包 / 编辑包裹两个表单共用：日本邮政运输方式清单与日元运费折算提示行。
import {yuan} from '../core/format';
import {quoteText} from '../core/rates';
import type {RateQuote, Currency} from '../types';

// 日本邮政个人国际邮件全方案（官网服务一览，按速度从快到慢）：
// EMS / 国际航空信函 / 小型包装物（航空·SAL·船运）/ 国际小包（航空·SAL·船运）。
// SAL 经济航空现全面停运，标注保留备查。
export const JP_METHODS: {value: string; label: string}[] = [
  {value: 'EMS', label: 'EMS'},
  {value: '国际航空信函', label: '国际航空信函（エアパケット）'},
  {value: '小型包装物 · 航空', label: '小型包装物 · 航空'},
  {value: '小型包装物 · SAL', label: '小型包装物 · SAL（停运）'},
  {value: '小型包装物 · 船运', label: '小型包装物 · 船运'},
  {value: '国际小包 · 航空', label: '国际小包 · 航空'},
  {value: '国际小包 · SAL', label: '国际小包 · SAL（停运）'},
  {value: '国际小包 · 船运', label: '国际小包 · 船运'},
];

// 历史运单可能是列表外的旧值（如「国际小包」「航空件」），编辑时追加为可选项保留显示
export const methodOptions = (cur: string) => {
  const os = JP_METHODS.slice();
  if (cur && !os.some(o => o.value === cur)) os.push({value: cur, label: cur});
  return os;
};

// 日元运费的折算提示行（与买入金额的「折合成本」口径一致）
export const costLineText = (currency: Currency, cost: string, rate: number | null, cny: number | null, quote?: RateQuote | null) => {
  if (currency !== 'JPY') return '';
  let text = `折合成本 ${cost === '' ? '—' : cny === null ? '待定' : yuan(Number(cny.toFixed(2)))}`;
  if (cost !== '' && cny === null) text += ' · ' + quoteText(quote ?? null);
  if (rate !== null) text += ` · ${quote ? quoteText(quote) : `100 円 = ¥${Number(rate).toFixed(2)}`}`;
  return text;
};

