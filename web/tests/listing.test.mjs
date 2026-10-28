import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';
const {require, output} = compiledSources();
const {draftFor, listingContextChanged} = require(join(output, 'core/listing.js'));

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

test('metadata changes invalidate analysis without deleting saved copy; money edits do not', () => {
  const record = {artist: 'A', title: 'B', photoCount: 0, photoRevision: 0, releaseInfo: {catalogNumber: 'CD-1', media: []}};
  const context = {album: {artist: 'A', title: 'B', releaseYear: ''}, release: {catalogNumber: 'CD-1'}, copy: {}};
  record.listingDraft = {title: '手写标题', description: '原文案', photoRevision: 0, photoOrder: [],
    analysis: {pending: []}, generation: {sourceContext: JSON.stringify(context)}};
  assert.equal(listingContextChanged(record), false);
  assert.equal(listingContextChanged({...record, price: '999'}), false);
  const changed = {...record, releaseInfo: {catalogNumber: 'CD-2'}};
  assert.equal(listingContextChanged(changed), true);
  const draft = draftFor(changed);
  assert.equal(draft.description, '原文案');
  assert.equal(draft.analysis, undefined);
});
