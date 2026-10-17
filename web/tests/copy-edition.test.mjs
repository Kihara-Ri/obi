import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, source, require} = compiledSources();
const {CopyEditionFields} = require(join(output, 'components/CopyEditionFields.js'));
const {copyEditionLabel} = require(join(output, 'core/copy-edition.js'));
const render = (obi = '') => renderToStaticMarkup(
  createElement(CopyEditionFields, {obi, onChange: () => {}}));

test('发行资料统一归入元数据，实物组件只编辑侧标', () => {
  const html = render();
  assert.match(html, /侧标（OBI）/);
  assert.doesNotMatch(html, /aria-label="实物版次"/);
  assert.match(html, /aria-label="侧标状态"/);
  assert.match(html, /未记录/);
  assert.match(html, /带侧标/);
  assert.match(html, /无侧标/);
});
test('历史副本的侧标仍可独立编辑', () => {
  assert.match(render('带侧标'), /class="on">带侧标/);
  assert.match(render('无侧标'), /class="on">无侧标/);
});
test('旧版次与侧标组合函数兼容已有记录', () => {
  assert.equal(copyEditionLabel('日版', '带侧标'), '日版·带侧标');
  assert.equal(copyEditionLabel('外版', '无侧标'), '外版·无侧标');
});
test('编辑表单的发行资料允许更正，侧标独立保存', () => {
  const form = readFileSync(join(source, 'forms/RecordForm.tsx'), 'utf8');
  assert.match(form, /<CopyEditionFields obi=\{v\.obi\}/);
  assert.match(form, /<ReleaseMetadataFields info=\{v\.releaseInfo\}/);
  assert.match(form, /set\(change\); dirty\(\)/);
  assert.match(form, /\.\.\.base\.current, \.\.\.v, status:/);
  assert.match(form, /version: releaseInfo\.packaging/);
  const detail = readFileSync(join(source, 'forms/DetailDrawer.tsx'), 'utf8');
  assert.match(detail, /releaseRegion\(r\.releaseInfo\?\.country, r\.pressing\)/);
});
