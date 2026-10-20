import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {output, require} = compiledSources();
const {branchLabel, brandsFromKeys, groupShops, mergeShops} = require(join(output, 'core/shop-groups.js'));
// 与 components/shopIcons.ts 的键同形（只取品牌关键词串）
const BRANDS = brandsFromKeys(['amazon|亚马', 'bookoff|ブックオフ', 'diskunion|disk union|ディスクユニオン', 'tower|タワレコ']);
const groups = list => groupShops(mergeShops(list, ''), BRANDS);

test('同一连锁的不同写法（空格、全角、日文）归为一个品牌，一级标签用规范品牌名', () => {
  const g = groups(['BOOKOFF 秋葉原駅前店', 'Book Off 松本店', 'ブックオフ 新宿', 'BOOKOFF 秋葉原駅前店', 'Amazon']);
  const bookoff = g.find(x => x.shops.length > 1);
  assert.equal(bookoff.label, 'BOOKOFF');
  assert.equal(bookoff.shops.length, 3, '松本店必须在连锁里，不能单列');
  assert.ok(!g.some(x => x.shops.length === 1 && /book/i.test(x.label)));
  assert.equal(g.find(x => x.label === 'Amazon').shops.length, 1);
});
test('品牌一级标签从不使用某一家分店的名字', () => {
  const g = groups(['Disk union下北沢店', 'diskunion 新宿', 'Disk Union 渋谷店']);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, 'Disk Union');
});
test('分店标签去掉品牌前缀，去不掉就保留全名', () => {
  const [g] = groups(['BOOKOFF 秋葉原駅前店', 'Book Off 松本店']);
  assert.deepEqual(g.shops.map(s => branchLabel(s.name, g.aliases)).sort(), ['松本店', '秋葉原駅前店'].sort());
  assert.equal(branchLabel('某某商店', g.aliases), '某某商店');
});
test('未知品牌按公共前缀成组；只有一家或前缀太短不成组', () => {
  const g = groups(['示例唱片行', '示例唱片行 C 店', '示例代购', 'abc 店', 'abd 店']);
  const chain = g.find(x => x.shops.length > 1);
  assert.equal(chain.label, '示例唱片行');
  assert.equal(chain.shops.length, 2);
  assert.ok(g.some(x => x.label === '示例代购' && x.shops.length === 1));
  assert.equal(g.filter(x => x.shops.length > 1).length, 1, '「示例」两字、「ab」前缀太短，不应并入');
});
test('同店不同写法先归并再统计次数', () => {
  const shops = mergeShops(['Disk union', 'disk union', 'DISK UNION', 'tower.jp'], '');
  assert.equal(shops[0].count, 3);
});
test('网址型线上店保留全名，不被截成「jp」；只有品牌名的历史记录标为未指定', () => {
  const g = groups(['tower.jp', 'タワレコ渋谷店', 'Tower Records 新宿', 'Tower Records']);
  const tower = g.find(x => x.label === 'Tower Records');
  assert.ok(tower, '线上店与实体店同属 Tower Records');
  const labels = tower.shops.map(s => branchLabel(s.name, tower.aliases));
  assert.ok(labels.includes('tower.jp'), '线上店不能缩成 jp：' + labels);
  assert.ok(labels.includes('新宿') && labels.includes('未指定'));
  assert.ok(!labels.some(l => l.toLowerCase() === 'jp'));
});
