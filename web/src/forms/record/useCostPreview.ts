// Purchase cost preview shares the quote lifecycle with shipment/sale forms.
import {yuan} from '../../core/format';
import {quoteText} from '../../core/rates';
import {useRate} from '../../core/use-rate';
import type {RecordValues} from './context';

export function useCostPreview(v: RecordValues, acquisition: boolean, actual = '') {
  const hidden = !acquisition || v.currency === 'CNY';
  const {rate, quote} = useRate(v.date, !hidden && v.price !== '' && actual === '');
  const base = actual !== '' ? Number(actual) : rate === null ? null : Number(v.price) * rate / 100;
  const known = actual !== '' || v.price !== '';
  const cost = !known || base === null ? null : base + Number(v.fees || 0);
  let text = `折合成本 ${!known ? '—' : cost === null ? '待定' : yuan(Number(cost.toFixed(2)))}`;
  if (v.price !== '' && actual === '') text += ' · ' + quoteText(quote);
  return {hidden, text};
}
