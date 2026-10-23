import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readdirSync, readFileSync} from 'node:fs';
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
  assert.doesNotMatch(html, /未记录/);   // 日版必填，只有「带侧标 / 无侧标」两项
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
  // 表单已按职责拆到 forms/record/，行为断言覆盖主文件与全部拆分模块。
  const form = ['forms/RecordForm.tsx', ...readdirSync(join(source, 'forms/record')).map(f => 'forms/record/' + f)]
    .map(f => readFileSync(join(source, f), 'utf8')).join('\n');
  assert.match(form, /<CopyEditionFields obi=\{v\.obi\}/);
  // 侧标只在日版出现，且日版必选（带侧标 / 无侧标）才能保存
  assert.match(form, /japan \? <CopyEditionFields/);
  assert.match(form, /releaseRegion\(v\.releaseInfo\.country, v\.pressing\) === '日版'/);
  assert.match(form, /japan && v\.obi !== '带侧标' && v\.obi !== '无侧标'/);
  assert.match(form, /<ReleaseMetadataFields info=\{v\.releaseInfo\}/);
  assert.match(form, /set\(change\); dirty\(\)/);
  assert.match(form, /\.\.\.base, \.\.\.v, status:/);
  assert.match(form, /version: releaseInfo\.packaging/);
  // 发行地区在详情的二级页「发行资料」里完整显示（D-015）
  const detail = readFileSync(join(source, 'forms/detail/ReleasePage.tsx'), 'utf8');
  // 已由发行版确定国家时详情显示地区名与代码（美国（US）），没有国家才退回日版 / 外版
  assert.match(detail, /regionName\(code\)/);
  assert.match(detail, /displayRegion\(code, r\.pressing\)/);
});
