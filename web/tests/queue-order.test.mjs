import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {oldestFirst} = require(join(output, 'core/queue-order.js'));

test('售出中 / 在途：等得最久的在最上面，同日按记录先后，不改原数组', () => {
  const list = [
    {id: 'b', date: '2026-11-17', createdAt: '2026-11-17T09:00'},
    {id: 'a', date: '2026-11-16', createdAt: '2026-11-16T20:00'},
    {id: 'c', date: '2026-11-17', createdAt: '2026-11-17T08:00'},
    {id: 'd', date: '2026-11-10'},
  ];
  assert.deepEqual(oldestFirst(list).map(x => x.id), ['d', 'a', 'c', 'b']);
  assert.deepEqual(list.map(x => x.id), ['b', 'a', 'c', 'd']);
});
