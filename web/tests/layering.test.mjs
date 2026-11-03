// AGENTS.md 的分层规则机检：core/ ← components/ ← pages/ 与 forms/，禁止反向 import。
// 打开表单、编排业务流程的卡片属于 pages/，被表单复用的纯展示放 components/。
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const FORBIDDEN = {core: ['components', 'pages', 'forms'], components: ['pages', 'forms']};

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(name)) yield path;
  }
}

test('下层模块不 import 上层（core ↛ components/pages/forms，components ↛ pages/forms）', () => {
  const violations = [];
  for (const [layer, banned] of Object.entries(FORBIDDEN)) {
    for (const file of files(join(src, layer))) {
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)) {
        const target = relative(src, resolve(dirname(file), spec)).split(/[\\/]/)[0];
        if (banned.includes(target)) violations.push(`${relative(src, file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});
