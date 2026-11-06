// Shared quote contract: request date and actual published date are separate.
import type {RateQuote} from '../types';
import {api} from './api';

export function quoteMatches(quote: RateQuote | null, date: string): boolean {
  return quote?.requestedDate === date;
}

export function quoteText(quote: RateQuote | null): string {
  if (!quote) return '查询汇率…';
  if (quote.status === 'future') return '未来汇率未知';
  if (quote.rate === null) return '暂无可靠汇率';
  const date = quote.quoteDate !== quote.requestedDate || quote.provisional ? `${quote.quoteDate} 报价 · ` : '';
  return `${date}100 円 = ¥${Number(quote.rate).toFixed(2)}`;
}

export const fetchQuote = (date: string, signal: AbortSignal) =>
  api<RateQuote>('rate?date=' + encodeURIComponent(date), undefined, {signal});

export const prepareQuotes = (dates: string[], signal: AbortSignal) =>
  api('rates/prepare', {dates}, {signal, readOnly: true});
