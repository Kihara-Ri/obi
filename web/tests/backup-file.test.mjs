import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {inspectBackup} = require(join(output, 'core/backup-file.js'));

// 按 server/archive.py 的布局手写一个最小 zip：前两项不压缩（tests/test_archive.py 锁定了这一布局）
function storedZip(entries) {
  const parts = [];
  for (const [name, text] of entries) {
    const n = Buffer.from(name), d = Buffer.from(text), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(d.length, 22);
    h.writeUInt16LE(n.length, 26);
    parts.push(h, n, d);
  }
  return Buffer.concat(parts);
}
const ledger = {format: 'album-ledger', createdAt: '2026-10-24T21:00:00', records: [{}, {}], sales: [{}], shipments: []};
const file = (data, name, type = '') => new File([data], name, {type});

test('认出完整备份包并读出账本', async () => {
  const zip = storedZip([['manifest.json', JSON.stringify({format: 'album-ledger-archive', files: {'photos/a/0.jpg': {}}})],
    ['ledger.json', JSON.stringify(ledger)]]);
  const r = await inspectBackup(file(zip, 'obi-backup.zip'));
  assert.equal(r.kind, 'archive');
  assert.equal(r.ledger.records.length, 2);
  assert.equal(r.files, 1);
});

test('旧版 .json 完整备份仍可恢复', async () => {
  assert.equal((await inspectBackup(file(JSON.stringify(ledger), 'album-ledger-backup.json'))).kind, 'legacy');
});

test('选错文件时说明原因', async () => {
  const csv = await inspectBackup(file('专辑,艺人\n', 'albums-20261024.csv', 'text/csv'));
  assert.match(csv.message, /表格/);
  const albums = await inspectBackup(file('[{"id":"1"}]', 'albums.json'));
  assert.match(albums.message, /albums\.json/);
  const other = await inspectBackup(file(storedZip([['readme.txt', 'hi']]), 'x.zip'));
  assert.match(other.message, /不是 Obi/);
});
