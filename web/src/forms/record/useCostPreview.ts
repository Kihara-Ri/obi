// 成本折算预览：日元金额按买入日期折算人民币（按日期缓存当日汇率）。
import {useEffect, useRef, useState} from 'react';
import {api} from '../../core/api';
import {today, yuan} from '../../core/format';
import type {RecordValues} from './context';

export function useCostPreview(v: RecordValues, acquisition: boolean) {
  const rateCache = useRef<{date: string; rate: number | null} | null>(null);
  const [preview, setPreview] = useState<{hidden: boolean; text: string}>({hidden: true, text: ''});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!acquisition || v.currency === 'CNY') { if (!cancelled) setPreview({hidden: true, text: ''}); return; }
      let rate: number | null = null;
      if (v.price !== '') {
        if (rateCache.current?.date === v.date) {
          rate = rateCache.current.rate;
        } else {
          try {
            const res = await api<{rate: number | null}>('rate?date=' + (v.date || today()));
            rate = res.rate;
          } catch { rate = null; }
          rateCache.current = {date: v.date, rate};
        }
      }
      if (cancelled) return;
      const fees = Number(v.fees || 0);
      const cost = rate ? Number(v.price) * Number(rate) / 100 + fees : null;
      let text = `折合成本 ${v.price === '' ? '—' : cost === null ? '待定' : yuan(Number(cost.toFixed(2)))}`;
      if (v.price !== '' && cost === null) text += ' · 暂无当日汇率';
      if (rate) text += ` · 100 円 = ¥${Number(rate).toFixed(2)}`;
      setPreview({hidden: false, text});
    })();
    return () => { cancelled = true; };
  }, [v.currency, v.price, v.date, v.fees, acquisition]);
  return preview;
}
