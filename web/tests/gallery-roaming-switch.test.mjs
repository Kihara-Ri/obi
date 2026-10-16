import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, source, require} = compiledSources();
const {GalleryRoamingSwitch} = require(join(output, 'components/GalleryRoamingControls.js'));

const render = (enabled, disabled = false) =>
  renderToStaticMarkup(createElement(GalleryRoamingSwitch, {enabled, disabled, onToggle() {}}));

test('漫游文字仅作为静态说明，switch 按钮只包住右侧轨道', () => {
  const markup = render(true);
  assert.match(markup, /<div class="gallery-roaming-switch" data-enabled="true">/);
  assert.match(markup, /<span class="gallery-roaming-switch-label">漫游<\/span><button /);
  const button = markup.match(/<button [^>]+>(.*?)<\/button>/);
  assert.ok(button);
  assert.match(button[0], /role="switch"/);
  assert.match(button[0], /aria-label="自动漫游"/);
  assert.match(button[0], /aria-checked="true"/);
  assert.doesNotMatch(button[1], /漫游/);
  assert.match(button[1], /gallery-roaming-switch-track/);
});
test('开关关闭与禁用不扩大触控区域，也保持 switch 语义', () => {
  const markup = render(false, true);
  assert.match(markup, /data-enabled="false"/);
  assert.match(markup, /role="switch" aria-label="自动漫游" aria-checked="false" disabled=""/);
  assert.equal((markup.match(/<button /g) || []).length, 1);
});
test('按下时不会继承全局按钮的 translateY 位移', () => {
  const styles = readFileSync(join(source, 'styles/gallery-roaming.css'), 'utf8');
  assert.match(styles, /\.gallery-roaming-switch-button:active\{transform:none\}/);
  assert.match(styles, /\.gallery-roaming-switch-button\{[^}]*transition:none;transform:none/);
  assert.match(styles, /\.gallery-roaming-switch-label\{cursor:default/);
});
