import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, require} = compiledSources();
const {GalleryRoamingSwitch} = require(join(output, 'components/GalleryRoamingControls.js'));

const render = (enabled, disabled = false) =>
  renderToStaticMarkup(createElement(GalleryRoamingSwitch, {enabled, disabled, onToggle() {}}));

test('漫游是一个整块可点的胶囊按钮，aria-pressed 表示开启', () => {
  const markup = render(true);
  assert.match(markup, /<button [^>]*class="gallery-roaming-toggle"[^>]*aria-pressed="true"/);
  assert.match(markup, /aria-label="自动漫游"/);
  assert.match(markup, /漫游<\/button>/);
  assert.equal((markup.match(/<button /g) || []).length, 1);
});
test('关闭与禁用状态', () => {
  const markup = render(false, true);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /disabled=""/);
});
