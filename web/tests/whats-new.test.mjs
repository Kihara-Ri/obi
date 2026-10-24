import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const store = new Map();
globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))};
const {parseChangelog, unseenNotes, markSeen} = require(join(output, 'core/whats-new.js'));

const notes = parseChangelog(`# 更新记录\n\n## 未发布\n\n- 还在改\n\n## v3.8.5（2026-10-24）\n\n- 五\n\n## v3.8.4（2026-10-24）\n\n- 四\n`);
beforeEach(() => store.clear());

test('「未发布」不进入更新说明', () => {
  assert.deepEqual(notes.map(n => n.version), ['v3.8.5', 'v3.8.4']);
});

test('构建号不触发弹窗，打了正式版才弹', () => {
  markSeen('v3.8.5');
  assert.deepEqual(unseenNotes('v3.8.5-3-gabc1234', notes), []);
  assert.deepEqual(unseenNotes('v3.8.5-3-gabc1234-dirty', notes), []);
  assert.deepEqual(unseenNotes('e5a5304', notes), []);
  markSeen('v3.8.5-3-gabc1234');
  assert.deepEqual(unseenNotes('v3.8.5-7-gdef5678', notes), []);
});

test('上次看到 v3.8.4，换到新正式版之后的构建仍补看 v3.8.5', () => {
  markSeen('v3.8.4');
  assert.deepEqual(unseenNotes('v3.8.5-1-gabc1234', notes).map(n => n.version), ['v3.8.5']);
});
