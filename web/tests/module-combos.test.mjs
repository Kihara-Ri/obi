import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {PRESETS, comboWho} = require(join(output, 'core/modules.js'));

// 海外周转依赖购入记录，合法组合共 12 种：每种都有自己的说法，不再落到「自定义组合」
const combos = [];
for (const acquisition of [false, true]) for (const trading of [false, true])
  for (const circulation of acquisition ? [false, true] : [false]) for (const showcase of [false, true])
    combos.push({acquisition, trading, circulation, showcase});

test('每种合法组合都有专属说法', () => {
  assert.equal(combos.length, 12);
  const said = combos.map(comboWho);
  assert.ok(!said.includes('自定义组合'));
  assert.equal(new Set(said).size, 12);
});

test('预设仍说适合谁，全开是「我全都要」', () => {
  for (const p of PRESETS) assert.equal(comboWho(p.enabled), p.who);
  assert.equal(comboWho({acquisition: true, trading: true, circulation: true, showcase: true}), '我全都要');
});
