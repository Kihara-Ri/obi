// Optional official plugin integrity check. Core 2D build has no model/runtime dependency.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base = new URL('../../', import.meta.url);
const catalogUrl = new URL('plugins/album-engine/catalog.json', base);
let raw;
try { raw = await readFile(catalogUrl, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (raw) {
  const catalog = JSON.parse(raw);
  if (catalog.id !== 'album-engine' || !/^[a-zA-Z0-9._-]+\.zip$/.test(catalog.file))
    throw new Error('Invalid Album Engine official catalog');
  const archive = await readFile(new URL('plugins/album-engine/' + catalog.file, base));
  if (createHash('sha256').update(archive).digest('hex') !== catalog.sha256)
    throw new Error('Album Engine optional package checksum mismatch');
  const codec = JSON.parse(await readFile(new URL('vendor/album_data/data-codec-manifest.json', base), 'utf8'));
  if (catalog.version !== codec.version || codec.schemaVersion !== 2 || codec.modelSet !== 'album-rig-1')
    throw new Error('Album Engine package and persistence codec mismatch');
}
