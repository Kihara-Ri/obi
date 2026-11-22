// 输入法回车：中文输入法确认候选词的回车不能当成提交（Safari 上 isComposing 不可靠，靠 keyCode 229 兜底）。
import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const {output, require} = compiledSources();
const {isPlainEnter} = require(join(output, 'core/ime.js'));

test('isPlainEnter：普通回车算，输入法确认候选词的回车不算', () => {
  assert.equal(isPlainEnter({key: 'Enter', keyCode: 13}), true);
  assert.equal(isPlainEnter({key: 'Enter', keyCode: 13, nativeEvent: {isComposing: false}}), true);
  assert.equal(isPlainEnter({key: 'Enter', keyCode: 13, nativeEvent: {isComposing: true}}), false);
  assert.equal(isPlainEnter({key: 'Enter', keyCode: 13, isComposing: true}), false);
  // Safari：确认候选词时 isComposing 已被重置为 false，但 keyCode 是 229
  assert.equal(isPlainEnter({key: 'Enter', keyCode: 229, nativeEvent: {isComposing: false}}), false);
  assert.equal(isPlainEnter({key: 'a', keyCode: 65}), false);
});

const src = fileURLToPath(new URL('../src/', import.meta.url));
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'vendor') yield* files(path); }
    else if (/\.tsx?$/.test(name)) yield path;
  }
}
// 不是文字输入框的回车（可聚焦卡片、展示页），不经过输入法，允许直接判断
const NOT_TEXT_INPUT = new Set(['forms/DetailDrawer.tsx', 'components/GalleryOrbit.tsx', 'core/ime.ts']);

test('文字输入框的回车一律经 isPlainEnter，不直接比较 key === Enter', () => {
  const offenders = [];
  for (const path of files(src)) {
    const rel = relative(src, path).split('\\').join('/');
    if (NOT_TEXT_INPUT.has(rel)) continue;
    if (/key\s*===\s*['"]Enter['"]/.test(readFileSync(path, 'utf8'))) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], '这些文件直接判断了 Enter，输入法选词会误触发；改用 core/ime 的 isPlainEnter');
});
