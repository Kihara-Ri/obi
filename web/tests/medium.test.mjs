import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';

const {output, require} = compiledSources();
const {mediumOf, recordMedium} = require(join(output, 'core/medium.js'));
const {lookupSources} = require(join(output, 'core/lookup.js'));
const {trackNo, discLabel, trackDiscs} = require(join(output, 'core/tracklist.js'));

test('介质从格式文字认出来，与服务端同一套规则', () => {
  assert.equal(mediumOf('12" Vinyl'), 'vinyl');
  assert.equal(mediumOf('7″'), 'vinyl');
  assert.equal(mediumOf('2×LP'), 'vinyl');
  assert.equal(mediumOf('SACD'), 'cd');
  assert.equal(mediumOf('Blu-spec CD2'), 'cd');
  assert.equal(mediumOf('Cassette'), 'other');
  assert.equal(mediumOf(''), null);
});

test('没写介质的旧记录按 CD；整体格式为空时看各碟', () => {
  assert.equal(recordMedium({}), 'cd');
  assert.equal(recordMedium(undefined), 'cd');
  assert.equal(recordMedium({format: '12" Vinyl'}), 'vinyl');
  assert.equal(recordMedium({media: [{position: 1, format: 'LP', title: '', tracks: []}]}), 'vinyl');
});

test('黑胶不问只收 CD 的资料库', () => {
  assert.deepEqual(lookupSources('barcode', 'cd'), ['musicbrainz', 'discogs', 'deezer', 'itunes']);
  assert.deepEqual(lookupSources('barcode', 'vinyl'), ['musicbrainz', 'discogs']);
  assert.deepEqual(lookupSources('catalog', 'vinyl'), ['musicbrainz', 'discogs']);
});

test('黑胶曲目显示面的编号，碟名用格式', () => {
  assert.equal(trackNo({position: 3, title: 'x'}), '03');
  assert.equal(trackNo({position: 1, title: 'x', number: 'B1'}), 'B1');
  const [disc] = trackDiscs({media: [{position: 1, format: '12" Vinyl', title: '', tracks: [{position: 1, number: 'A1', title: 'Born Under Punches'}]}]});
  assert.equal(disc.tracks[0].number, 'A1');
  assert.equal(discLabel(disc), '12" Vinyl 1');
  assert.equal(discLabel({position: 2, format: '', title: '', tracks: []}), 'CD 2');
});
