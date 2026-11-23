// 固定样本在手机布局中验收排序与闲鱼商品入口。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, devices, webkit} from 'playwright';
import {fastFail, reportFailure, settle} from './acceptance-kit.mjs';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-browser';
await mkdir(output, {recursive: true});
const {records} = await (await fetch(base + '/api/state')).json();
const newer = records.find(record => record.xianyuItemId === '1004');
const older = records.find(record => record.xianyuItemId === '1005');
assert.ok(newer && older);
assert.equal(newer.listingUrl, 'https://www.goofish.com/item?id=1004');
assert.equal(newer.listingChannel, '闲鱼');
assert.equal(newer.listed, true);
assert.ok(!('listingDescription' in newer) && !('listingDraft' in newer));
const appUrl = 'fleamarket://awesome_detail?id=1004&flutter=true';
const engines = process.env.OBI_LISTING_WEBKIT === '1' ? [chromium, webkit] : [chromium];
const screenshotCsp = "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

async function verifySystemTheme(page) {
  await page.evaluate(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const title = document.querySelector('#panel .drawer-head h2');
    const value = document.querySelector('.drawer-page:not(.is-covered) .detail-grid dd');
    dark.addEventListener('change', () => requestAnimationFrame(() => {
      window.themeFrame = [dark.matches, getComputedStyle(title.closest('.drawer')).backgroundColor,
        getComputedStyle(title).color, getComputedStyle(value).color,
        document.documentElement.classList.contains('theme-fade')];
    }));
  });
  await page.emulateMedia({colorScheme: 'light'});
  await page.waitForFunction(() => window.themeFrame?.[0] === false &&
    getComputedStyle(document.body).color === 'rgb(30, 36, 48)');
  await page.emulateMedia({colorScheme: 'dark'});
  const frame = await page.waitForFunction(() => window.themeFrame?.[0] && window.themeFrame);
  assert.deepEqual(await frame.jsonValue(), [true, 'rgb(22, 25, 32)', 'rgb(232, 235, 241)', 'rgb(232, 235, 241)', false],
    '跟随系统恢复深色时，抽屉背景、标题和字段值应首帧同步');
}

async function verifyMobile(context, filename, colorScheme) {
  const page = await context.newPage();
  const errors = [];
  const webNavigations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await context.route(url => /^https?:$/u.test(url.protocol) && /(^|\.)goofish\.com$/u.test(url.hostname), route => {
    webNavigations.push(route.request().url());
    return route.fulfill({contentType: 'text/html', body: '<h1>Sample product</h1>'});
  });
  await page.addInitScript(() => {
    // 模拟系统切到后台再返回，或始终不给 Obi 页面生命周期事件。
    const click = HTMLAnchorElement.prototype.click;
    window.xianyuAttempts = [];
    Object.defineProperty(document, 'hasFocus', {value: () => true});
    HTMLAnchorElement.prototype.click = function () {
      if (this.protocol !== 'fleamarket:') return click.call(this);
      window.xianyuAttempts.push({url: this.href, activated: navigator.userActivation?.isActive});
      if (!window.xianyuSendsPageEvents) return;
      Object.defineProperty(document, 'hidden', {configurable: true, value: true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await page.goto(base + '/#overseas');
  const filter = page.getByRole('group', {name: '上架筛选'});
  const sort = page.getByRole('combobox', {name: /^排序方式/u});
  const cards = page.locator('.shelf-page article.card[data-id]');
  const order = () => cards.evaluateAll(items => items.map(item => item.dataset.id));
  const pick = label => page.getByRole('option', {name: label, exact: true}).tap();

  await sort.tap();
  assert.equal(await page.getByRole('option', {name: '最近上架', exact: true}).count(), 0);
  await sort.press('Escape');
  await filter.getByRole('button', {name: '已上架', exact: true}).tap();
  assert.match(await sort.textContent(), /最近上架/u);
  assert.deepEqual(await order(), [newer.id, older.id]);
  await sort.tap();
  await settle(page, ['.dd-list', '.shelf-page .grid']);
  assert.deepEqual(errors, []);
  await page.screenshot({caret: 'initial', path: join(output, `${filename}-sort.png`)});
  await pick('最早上架');
  assert.deepEqual(await order(), [older.id, newer.id]);
  await page.getByRole('button', {name: '卡片视图'}).tap();
  assert.deepEqual(await order(), [older.id, newer.id]);
  await page.getByRole('button', {name: '列表视图'}).tap();
  await filter.getByRole('button', {name: '全部专辑', exact: true}).tap();
  assert.match(await sort.textContent(), /最近买入/u);
  await filter.getByRole('button', {name: '已上架', exact: true}).tap();
  assert.deepEqual(await order(), [older.id, newer.id]);

  await page.getByRole('button', {name: newer.title, exact: true}).tap();
  await page.getByRole('button', {name: '管理', exact: true}).tap();
  const manage = page.locator('.detail-page');
  const button = manage.getByRole('button', {name: '打开商品页面 ↗', exact: true});
  await button.waitFor();
  assert.equal(await manage.getByRole('heading', {name: '上架', exact: true}).count(), 1);
  const rows = manage.locator('dl').filter({has: page.getByText('链接', {exact: true})});
  assert.deepEqual(await rows.locator('dt').allTextContents(), ['状态', '平台', '链接']);
  assert.deepEqual(await rows.locator('dd').allTextContents(), ['已上架', '闲鱼', '打开商品页面 ↗']);
  const platformIcon = rows.locator('.shop-mark-inline[aria-hidden="true"] img');
  await platformIcon.waitFor();
  assert.ok(await platformIcon.evaluate(async icon => {
    await icon.decode();
    return icon.naturalWidth > 0 && getComputedStyle(icon).width === '16px';
  }));
  assert.ok(await button.evaluate(el => {
    const style = getComputedStyle(el);
    return style.padding === '0px' && style.borderTopWidth === '0px' &&
      style.fontSize === getComputedStyle(el.parentElement).fontSize && style.textDecorationLine === 'underline';
  }));
  assert.equal(await manage.getByText('示例历史上架标题', {exact: true}).count(), 0);
  assert.equal(await manage.getByText(/示例历史上架正文/u).count(), 0);
  assert.equal(await manage.getByRole('button', {name: '复制上架描述'}).count(), 0);
  assert.equal(await manage.locator('a[href*="goofish.com"]').count(), 0);
  assert.equal(await button.evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))), false);
  assert.deepEqual(webNavigations, []);
  await button.scrollIntoViewIfNeeded();
  if (colorScheme === 'dark') await verifySystemTheme(page);
  await settle(page, ['#panel', '.detail-page', '.listing-entry']);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({caret: 'initial', path: join(output, `${filename}-manage.png`)});
  await page.clock.install();
  for (const sendsPageEvents of [true, false, false]) {
    await page.evaluate(value => {window.xianyuSendsPageEvents = value;}, sendsPageEvents);
    await button.tap();
    assert.deepEqual(await page.evaluate(() => window.xianyuAttempts.splice(0)), [{url: appUrl, activated: true}]);
    await page.clock.runFor(2000);
    await settle(page, ['#panel', '.detail-page', '.listing-entry']);
    assert.deepEqual(webNavigations, [], '闲鱼入口只唤起 App，不请求商品网页');
    assert.equal(page.url(), base + '/#overseas');
    assert.equal(context.pages().length, 1, '唤起 App 不另开标签页');
  }
  // WebKit 的截图实现有时会注入临时光标样式，站点 CSP 会拒绝它。
  assert.deepEqual(errors.filter(message => !filename.startsWith('webkit-') || message !== screenshotCsp), []);
}

async function verifyMobileBatchForm(context) {
  const page = await context.newPage();
  const titles = ['Shall We Dance? Shall We Talk!', "Larks' Tongues in Aspic"];
  const links = ['https://example.com/listing/1010', 'https://example.com/listing/1011'];
  await page.goto(base + '/#domestic');
  await page.getByRole('button', {name: '选择', exact: true}).tap();
  for (const title of titles) {
    const checkbox = page.getByRole('checkbox', {name: `选择 ${title}`, exact: true});
    await page.locator('label.select-lead').filter({has: checkbox}).tap();
  }
  await page.getByRole('toolbar', {name: '批量操作'}).getByRole('button', {name: '标记上架', exact: true}).tap();
  await page.getByRole('heading', {name: '批量上架', exact: true}).waitFor();
  const form = page.locator('#listing-form');
  const enter = async (field, label, value) => {
    await field.tap();
    const focus = page.getByRole('dialog', {name: label, exact: true});
    await focus.getByRole('textbox').fill(value);
    await focus.getByRole('button', {name: '完成', exact: true}).tap();
  };
  await enter(form.getByLabel('平台', {exact: true}), '平台', '示例二手平台');
  for (const [index, title] of titles.entries()) {
    const copy = form.locator('.form-section').filter({hasText: title});
    await enter(copy.getByLabel('商品链接', {exact: true}), '商品链接', links[index]);
  }
  await settle(page, ['#panel', '#listing-form']);
  await page.screenshot({caret: 'initial', path: join(output, 'listing-batch-mobile.png')});
  const [reply] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/listing/details'),
    form.getByRole('button', {name: '确认上架', exact: true}).tap(),
  ]);
  assert.equal(reply.status(), 200);
  const {records: current} = await (await fetch(base + '/api/state')).json();
  for (const [index, title] of titles.entries()) {
    const record = current.find(r => r.title === title);
    assert.deepEqual([record.listed, record.listingChannel, record.listingUrl], [true, '示例二手平台', links[index]]);
  }
  await page.close();
}

for (const engine of engines) {
  const browser = await engine.launch({headless: true});
  try {
    for (const {width, colorScheme} of [
      {width: 390, colorScheme: 'light'}, {width: 390, colorScheme: 'dark'},
      {width: 340, colorScheme: 'light'}, {width: 340, colorScheme: 'dark'},
    ]) {
      const context = fastFail(await browser.newContext({...devices['iPhone 13'],
        viewport: {width, height: 844}, deviceScaleFactor: 2, colorScheme}));
      await verifyMobile(context, `${engine.name()}-${width}-${colorScheme}`, colorScheme);
      if (engine === chromium && width === 390 && colorScheme === 'light') await verifyMobileBatchForm(context);
      await context.close();
    }
  } catch (error) {
    await reportFailure(browser, output, `navigation-${engine.name()}`);
    throw error;
  } finally {await browser.close();}
}
console.log('长按菜单、App 跳转、默认上架顺序与手机批量填报通过：' + engines.map(engine => engine.name()).join('、'));
