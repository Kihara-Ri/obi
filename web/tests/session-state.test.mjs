import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {compiledSources} from './helpers/compiled-sources.mjs';

const {source} = compiledSources();
const read = file => readFileSync(join(source, file), 'utf8');

test('设置页的标签与展示页搜索词记在会话里，进入子页（如回收站）再返回不丢', () => {
  // 回归：设置页 tab 原来是组件内 useState，进回收站卸载后返回，永远回到第一个标签「功能」
  assert.match(read('pages/SettingsPage.tsx'), /useSessionState<Tab>\('settings-tab'/);
  assert.doesNotMatch(read('pages/SettingsPage.tsx'), /useState<Tab>/);
  assert.match(read('pages/GalleryPage.tsx'), /useSessionState<string>\('gallery-query'/);
});
test('useSessionState：读不到 / 值不在允许列表 / 存储不可用时都退回默认值，不抛错', () => {
  const hook = read('core/useSessionState.ts');
  assert.match(hook, /allowed\.includes\(saved\)/);
  assert.equal((hook.match(/catch/g) || []).length >= 2, true, '读和写都必须 try/catch（隐私模式下 sessionStorage 会抛）');
});
