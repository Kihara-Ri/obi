import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir, copyFile, readdir, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('@diedu/album-engine/models/manifest.json'));
const target = fileURLToPath(new URL('../../static/models/packaging/', import.meta.url));
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
const runtimeManifest = JSON.parse(await readFile(new URL('../../vendor/album_engine/runtime-manifest.json', import.meta.url), 'utf8'));
const engineManifest = JSON.parse(await readFile(require.resolve('@diedu/album-engine/manifest.json'), 'utf8'));
if (['version', 'modelSet', 'schemaVersion', 'rigVersion'].some(key => engineManifest[key] !== runtimeManifest[key]))
  throw new Error('Album Engine viewer/runtime version mismatch; export matching engine runtime before building');
if (manifest.schemaVersion !== 1 || manifest.rigVersion !== 1) throw new Error('Unsupported album-engine model manifest');
const files = ['manifest.json', ...Object.keys(manifest.models).map(name => name + '.glb')];
await mkdir(target, {recursive:true});
// Only framework-generated model files are replaced; application data is elsewhere.
for (const name of await readdir(target))
  if ((name.endsWith('.glb') || name === 'manifest.json') && !files.includes(name)) await unlink(join(target, name));
for (const name of files) await copyFile(join(source, name), join(target, name));
await writeFile(join(target, 'engine-manifest.json'), JSON.stringify(engineManifest, null, 2) + '\n');
