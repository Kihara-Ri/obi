// ui 单元组件的语义与结构：服务端渲染出的标记必须带齐可访问性属性，
// 这些是读屏、键盘与自动化测试依赖的稳定契约（交互行为见 components/ui/*/ 头部注释）。
import {compiledSources} from './helpers/compiled-sources.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {output, require} = compiledSources();
const ui = require(join(output, 'components/ui/index.js'));
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test('Dropdown：combobox 语义、名称含当前值、浮层默认隐藏、禁用项标记', () => {
  const html = render(ui.Dropdown, {
    id: 'sort', label: '排序方式', value: 'cost', onPick: () => {},
    options: [{value: 'new', label: '最近买入'}, {value: 'cost', label: '成本'}, {value: 'x', label: '停用', disabled: true}],
  });
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-label="排序方式：成本"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /class="dd-list" id="sort-list" role="listbox" aria-label="排序方式" hidden=""/);
  assert.match(html, /id="sort-opt-1" role="option" aria-selected="true"/);
  assert.match(html, /id="sort-opt-2" role="option" aria-selected="false" aria-disabled="true"/);
});

test('Dropdown：未传 id 也能生成唯一前缀', () => {
  const html = render(ui.Dropdown, {label: 'x', value: 'a', onPick: () => {}, options: [{value: 'a', label: 'A'}]});
  assert.match(html, /aria-controls="[^"]+-list"/);
});

test('Seg：每段 aria-pressed，选中段带 on，纯图标段有名称与提示', () => {
  const html = render(ui.Seg, {
    ariaLabel: '外观', value: 'dark', onValue: () => {},
    options: [{value: 'light', label: '☀', ariaLabel: '浅色', title: '浅色'}, {value: 'dark', label: '☾', ariaLabel: '深色', title: '深色'}],
  });
  assert.match(html, /role="group" aria-label="外观"/);
  assert.match(html, /aria-pressed="false" aria-label="浅色" title="浅色"/);
  assert.match(html, /aria-pressed="true" aria-label="深色" title="深色" class="on"/);
});

test('Seg：整组禁用时每段都禁用', () => {
  const html = render(ui.Seg, {value: 'a', onValue: () => {}, disabled: true, options: [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]});
  assert.equal(html.match(/disabled=""/g)?.length, 2);
});

test('Switch：role=switch、aria-checked、名称与禁用', () => {
  const on = render(ui.Switch, {on: true, onToggle: () => {}, label: '自动漫游'});
  assert.match(on, /role="switch" aria-checked="true" aria-label="自动漫游"/);
  assert.match(on, /class="switch on"/);
  const off = render(ui.Switch, {on: false, onToggle: () => {}, disabled: true});
  assert.match(off, /aria-checked="false"/);
  assert.match(off, /disabled=""/);
});

test('SearchField：有内容才出现清除按钮', () => {
  const empty = render(ui.SearchField, {value: '', onChange: () => {}, ariaLabel: '搜索专辑', placeholder: '搜索…'});
  assert.doesNotMatch(empty, /search-clear/);
  assert.match(empty, /aria-label="搜索专辑"/);
  const filled = render(ui.SearchField, {value: 'abc', onChange: () => {}, ariaLabel: '搜索专辑'});
  assert.match(filled, /class="search has-value"/);
  assert.match(filled, /class="search-clear" aria-label="清除搜索"/);
});

test('Combobox：输入框 combobox 语义、关联浮层、选项带 id 且默认隐藏', () => {
  const html = render(ui.Combobox, {
    id: 'shop', value: '', onChange: () => {}, listLabel: '已有店铺',
    options: [{value: 'a', label: '店 A'}, {value: 'b', label: '店 B', leading: createElement('i', null, 'ico')}],
    leading: createElement('b', null, 'L'), emptyHint: '没有',
  });
  assert.match(html, /id="shop"[^>]*role="combobox"[^>]*aria-expanded="false"[^>]*aria-controls="shop-list"/);
  assert.match(html, /id="shop-list" class="cb-list" role="listbox" aria-label="已有店铺" hidden=""/);
  assert.match(html, /id="shop-opt-0" role="option"/);
  assert.match(html, /cb-control has-leading/);
  assert.match(html, /<i>ico<\/i>/);
});

test('Toast：错误用 alert，其余 status；按级别设定环绕时长', () => {
  const err = render(ui.Toast, {kind: 'err', text: '失败', onDone: () => {}});
  assert.match(err, /role="alert" aria-live="assertive"/);
  assert.match(err, /--toast-ms:6000ms/);
  const ok = render(ui.Toast, {kind: 'ok', text: '已保存', onDone: () => {}});
  assert.match(ok, /role="status" aria-live="polite"/);
  assert.match(ok, /--toast-ms:2000ms/);
});

test('NavRow：链接 / 按钮 / 静态三种形态，右侧数值与箭头', () => {
  const link = render(ui.NavRow, {href: '#ledger', icon: '▧', title: '账本概览', value: '16 张'});
  assert.match(link, /<a class="nav-row" href="#ledger"/);
  assert.match(link, /class="nav-row-value">16 张/);
  assert.match(link, /class="nav-row-arrow"/);
  const button = render(ui.NavRow, {onClick: () => {}, icon: 'x', title: '安装'});
  assert.match(button, /<button type="button" class="nav-row"/);
  const stat = render(ui.NavRow, {icon: 'x', title: '外观', trailing: createElement('i', null, 'T')});
  assert.match(stat, /<div class="nav-row">/);
  assert.match(stat, /<i>T<\/i>/);
  assert.doesNotMatch(stat, /nav-row-arrow/);
  assert.doesNotMatch(render(ui.NavRow, {href: '#a', icon: 'x', title: 't', value: ''}), /nav-row-value/);
});

test('Disclosure：默认收起，摘要可自定义', () => {
  const html = render(ui.Disclosure, {children: createElement('p', null, '内容')});
  assert.match(html, /<details class="disclosure"><summary>说明<\/summary>/);
  assert.doesNotMatch(html, /open=""/);
  assert.match(render(ui.Disclosure, {summary: '各模块说明', children: 'x'}), /<summary>各模块说明<\/summary>/);
});
