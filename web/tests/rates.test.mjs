import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';
const {output, require}=compiledSources();
const {quoteText, quoteMatches}=require(join(output,'core/rates.js'));

test('换日期时不允许复用上一日期的报价，未来与等待状态有明确提示',()=>{
  const quote={requestedDate:'2026-08-20',quoteDate:'2026-08-19',rate:'4.7',status:'previous'};
  assert.equal(quoteMatches(quote,'2026-08-21'),false);
  assert.equal(quoteMatches(quote,'2026-08-20'),true);
  assert.match(quoteText(quote),/2026-08-19/);
  assert.equal(quoteText({...quote,status:'future',rate:null}),'未来汇率未知');
  assert.equal(quoteText(null),'查询汇率…');
});
