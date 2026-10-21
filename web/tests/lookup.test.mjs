import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {releaseText, askText} = require(join(output, 'core/lookup-text.js'));
const {classify, isTextQuery, releasePending, ownedAlbums, gs1Valid, localMatches, pushRecent} = require(join(output, 'core/lookup.js'));

test('条码校验位按 GS1 规则计算', () => {
  assert.equal(gs1Valid('4006381333931'), true);
  assert.equal(gs1Valid('4006381333932'), false);
  assert.equal(gs1Valid('96385074'), true);
});

test('输入自动识别：条码、编号与错误提示', () => {
  assert.deepEqual(classify(' 4006 3813-33931 '), {ok: true, kind: 'barcode', value: '4006381333931'});
  assert.equal(classify('4006381333932').ok, false);
  assert.deepEqual(classify('AMCY-2434'), {ok: true, kind: 'catalog', value: 'AMCY-2434'});
  assert.deepEqual(classify('123456'), {ok: true, kind: 'catalog', value: '123456'});
  assert.equal(classify('  ').ok, false);
  assert.equal(classify('a<b>').ok, false);
});

test('本地命中：条码按数字、编号忽略空格连字符并支持多厂牌', () => {
  const records = [
    {id: 'a', releaseInfo: {barcode: '4006381333931', catalogNumber: 'AMCY-2434 / XYZ 9'}},
    {id: 'b', releaseInfo: {}}, {id: 'c'},
  ];
  assert.deepEqual(localMatches(records, 'barcode', '4006381333931').map(r => r.id), ['a']);
  assert.deepEqual(localMatches(records, 'catalog', 'amcy 2434').map(r => r.id), ['a']);
  assert.deepEqual(localMatches(records, 'catalog', 'xyz-9').map(r => r.id), ['a']);
  assert.deepEqual(localMatches(records, 'catalog', '!!').map(r => r.id), []);
});

test('最近查询去重并置顶，最多 8 条', () => {
  let list = [];
  for (let i = 0; i < 10; i++) list = pushRecent(list, 'q' + i);
  assert.equal(list.length, 8);
  assert.deepEqual(pushRecent(['a', 'b'], 'b'), ['b', 'a']);
});

test('复制文字：含版本资料与曲目，不含实物观察与个人信息，提问版带前缀', () => {
  const c = {id: 'x', title: 'IV', artist: 'Led Zeppelin', url: 'https://musicbrainz.org/release/x', releaseInfo: {}};
  const info = {catalogNumber: 'AMCY-2434', barcode: '4988029243447', label: 'Atlantic', matrix: 'secret',
    media: [{position: 1, format: 'CD', title: '', tracks: [{position: 1, title: 'Black Dog', lengthMs: 296000}]}]};
  const text = releaseText(c, info, '已有 1 张（国内库存）');
  assert.match(text, /^Led Zeppelin - IV\n/);
  assert.match(text, /唱片编号：AMCY-2434/);
  assert.match(text, /我的收藏：已有 1 张/);
  assert.match(text, /1\. Black Dog \(4:56\)/);
  assert.doesNotMatch(text, /secret/);
  assert.ok(askText(text).endsWith(text));
  assert.match(askText(text), /不要编造/);
});

test('查询页文字搜索识别：条码 / 编号不受影响，专辑名与艺人名走文字', () => {
  for (const q of ['illinois sufjan stevens', 'Sufjan', 'radiohead ok computer', 'kid a 2000', '宇多田ヒカル First Love'])
    assert.equal(isTextQuery(q), true, q);
  for (const q of ['4006381333931', '4006 3813-33931', 'AMCY-2434', 'AMCY 2434', '123456', 'ABC-DEF'])
    assert.equal(isTextQuery(q), false, q);
});

test('文字搜索结果里库里已有的同名专辑', () => {
  const records = [{id: '1', title: 'Illinois', artist: 'Sufjan Stevens'}, {id: '2', title: 'Illinois', artist: 'Other'}];
  assert.deepEqual(ownedAlbums(records, 'illinois', 'Sufjan Stevens').map(r => r.id), ['1']);
});

test('待确认发行版：已绑定版本或标过手动的不算，已售出与回收站不管', () => {
  const r = (status, releaseInfo) => ({status, releaseInfo});
  assert.equal(releasePending(r('domestic', undefined)), true);
  assert.equal(releasePending(r('overseas', {barcode: '123'})), true);
  assert.equal(releasePending(r('domestic', {musicBrainzReleaseId: 'x'})), false);
  assert.equal(releasePending(r('domestic', {discogsReleaseId: '7'})), false);
  assert.equal(releasePending(r('domestic', {manualRelease: '1'})), false);
  assert.equal(releasePending(r('sold', {})), false);
  assert.equal(releasePending(r('trash', {})), false);
});
