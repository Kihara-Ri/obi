// A form owns its quote request; changing date immediately hides the old value.
import {useEffect, useState} from 'react';
import type {RateQuote} from '../types';
import {today} from './format';
import {fetchQuote, quoteMatches} from './rates';

export function useRate(date: string, enabled = true) {
  const requested = date || today();
  const [result, setResult] = useState<RateQuote | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult(null);
    fetchQuote(requested, controller.signal).then(quote => {
      if (!controller.signal.aborted) setResult(quote);
    }).catch(() => {
      if (!controller.signal.aborted) setResult({requestedDate: requested, quoteDate: null, rate: null,
        source: '', status: 'unavailable', checkedAt: null, provisional: false});
    });
    return () => controller.abort();
  }, [requested, enabled]);
  const quote = enabled && quoteMatches(result, requested) ? result : null;
  return {quote, rate: quote?.rate == null ? null : Number(quote.rate), loading: enabled && !quote};
}
