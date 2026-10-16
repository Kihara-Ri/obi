import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {output, require} = compiledSources();
const {displayReleaseTitle, releaseRegion, exactDigitalCover} = require(join(output, 'core/release-metadata.js'));

test('MusicBrainz editorial square brackets do not pollute display titles', () => {
  assert.equal(displayReleaseTitle('[Led Zeppelin IV]'), 'Led Zeppelin IV');
  assert.equal(displayReleaseTitle('Led Zeppelin [IV]'), 'Led Zeppelin [IV]');
  assert.equal(displayReleaseTitle('[[untitled]]'), '[[untitled]]');
});
test('Release country maps to the historical Japan/overseas labels, never inventory location', () => {
  assert.equal(releaseRegion('JP'), '日版');
  assert.equal(releaseRegion('US'), '外版');
  assert.equal(releaseRegion('GB'), '外版');
  assert.equal(releaseRegion('', '日版'), '日版');
  assert.equal(releaseRegion(''), '');
});

test('iTunes digital artwork wins only on exact artist and album matches', () => {
  const choices = [
    {exact: false, provider: 'iTunes', token: 'similar-title'},
    {exact: true, provider: 'MusicBrainz / Cover Art Archive', token: 'physical-scan'},
    {exact: true, provider: 'iTunes', token: 'digital-master'},
  ];
  assert.equal(exactDigitalCover(choices)?.token, 'digital-master');
  assert.equal(exactDigitalCover(choices.slice(0, 2)), undefined);
  assert.equal(exactDigitalCover([]), undefined);
});
