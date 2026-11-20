import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {retrySrc} = require(join(output, 'components/ui/photoSave.js'));

test('灯箱重读只给本站照片接口加参数，本地地址原样', () => {
  assert.equal(retrySrc('/api/photo/ab/0?photoRevision=2', 0), '/api/photo/ab/0?photoRevision=2');
  assert.equal(retrySrc('https://x.test/api/photo/ab/0?photoRevision=2', 1), 'https://x.test/api/photo/ab/0?photoRevision=2&retry=1');
  assert.equal(retrySrc('/api/photo/ab/1', 1), '/api/photo/ab/1?retry=1');
  assert.equal(retrySrc('data:image/jpeg;base64,AAAA', 1), 'data:image/jpeg;base64,AAAA');
  assert.equal(retrySrc('blob:https://x.test/123', 1), 'blob:https://x.test/123');
});
