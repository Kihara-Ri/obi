import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';
const {require, output} = compiledSources();
const {draftFor, saleDescription} = require(join(output, 'core/listing.js'));

test('stale photos keep manual copy but clear obsolete evidence, choices and confirmation', () => {
  const draft = draftFor({artist: 'A', title: 'B', photoCount: 2, photoRevision: 4,
    listingDraft: {title: '手写标题', description: '手写描述', photoRevision: 3,
      photoOrder: [1], versionConfirmed: true, conditionConfirmed: true, analysis: {pending: ['old']}}});
  assert.equal(draft.description, '手写描述');
  assert.deepEqual(draft.photoOrder, [0, 1]);
  assert.equal(draft.versionConfirmed, false);
  assert.equal(draft.conditionConfirmed, false);
  assert.equal(draft.analysis, undefined);
});

test('generation requires confirmation and includes only reviewed public text', () => {
  const base = {versionText: '某版', conditionText: '盒面有擦痕', versionConfirmed: false, conditionConfirmed: true};
  assert.throws(() => saleDescription(base));
  assert.equal(saleDescription({...base, versionConfirmed: true}), '版本：某版\n品相：盒面有擦痕\n实物及附件以本帖照片和上述说明为准。');
});
