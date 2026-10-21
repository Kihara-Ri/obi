import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {encodeEan} = require(join(output, 'core/ean.js'));

test('EAN-13 编码：4006381333931 的标准条形', () => {
  const ean = encodeEan('4006381333931');
  assert.equal(ean.valid, true);
  assert.equal(ean.modules.length, 95);
  // 头 101 + 左半首位（第 2 位数字 0，奇偶 L → 0001101）+ ... + 中线 01010 + 护线 101
  assert.equal(ean.modules.slice(0, 3), '101');
  assert.equal(ean.modules.slice(3, 10), '0001101');
  assert.equal(ean.modules.slice(45, 50), '01010');
  assert.equal(ean.modules.slice(-3), '101');
});

test('UPC-A（12 位）等同前补 0 的 EAN-13；图中条码 886973121122 校验位正确', () => {
  const upc = encodeEan('886973121122');
  assert.equal(upc.digits, '0886973121122');
  assert.equal(upc.valid, true);
  assert.equal(encodeEan('0886973121122').modules, upc.modules);
});

test('EAN-8 为 67 个模块；非数字 / 不支持的位数返回 null；校验位错误照画但标记', () => {
  assert.equal(encodeEan('96385074').modules.length, 67);
  assert.equal(encodeEan('abc'), null);
  assert.equal(encodeEan('12345'), null);
  assert.equal(encodeEan('4006381333932').valid, false);
});
