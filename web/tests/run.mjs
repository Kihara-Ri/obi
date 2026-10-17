import {spawnSync} from 'node:child_process';
import {readdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileSources} from './helpers/compiled-sources.mjs';

const output = compileSources();
try {
  const files = readdirSync(new URL('./', import.meta.url)).filter(name => name.endsWith('.test.mjs'))
    .sort().map(name => fileURLToPath(new URL(name, import.meta.url)));
  const result = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit', env: {...process.env, DIEDU_TEST_COMPILED: output},
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {rmSync(output, {recursive: true, force: true});}
