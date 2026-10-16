import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const {output, source, require} = compiledSources();
const {publishedAlbum} = require(join(output, 'core/published-album.js'));
const fixture = JSON.parse(execFileSync('python3', ['-c', `
import json,sys
from tools.seed_samples import seed_models,open_store
ids=seed_models(sys.argv[1]);store=open_store(sys.argv[1]);rid=ids['lift-fists']
print(json.dumps({'record':next(r for r in store.state()['records'] if r['id']==rid),'job':store.twin_index()['jobs'][rid]}))
`, join(output, 'published-album-samples')], {cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8'}));

test('only a current published and engine-supported entity can be switched to 3D', () => {
  const published = publishedAlbum(fixture.record, fixture.job);
  assert.equal(published?.entity.schemaVersion, 2);
  assert.equal(publishedAlbum(fixture.record, {...fixture.job, status: 'stale'}), null);
  assert.equal(publishedAlbum(fixture.record), null);
  assert.equal(publishedAlbum(fixture.record, {...fixture.job, entity: {...fixture.job.entity,
    document: {...fixture.job.entity.document, modelSet: 'unsupported'}}}), null);
});

test('entity passes directly to the engine while the host only authorizes known assets', () => {
  const published = publishedAlbum(fixture.record, fixture.job);
  assert.equal(published.entity, fixture.job.entity.document);
  const asset = published.entity.preview.asset;
  assert.equal(published.resolveAsset(asset), '/api/twin-assets/' + fixture.job.id + '/' + asset);
  assert.equal(published.resolveAsset('../private'), '');
});
