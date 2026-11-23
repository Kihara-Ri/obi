// 固定样本在手机布局中验收排序与闲鱼商品入口。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, devices, webkit} from 'playwright';
import {fastFail, reportFailure, settle, STEP_TIMEOUT} from './acceptance-kit.mjs';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-browser';
await mkdir(output, {recursive: true});
const {records} = await (await fetch(base + '/api/state')).json();
const newer = records.find(record => record.xianyuItemId === '1004');
const older = records.find(record => record.xianyuItemId === '1005');
assert.ok(newer?.listingDraft && older);
assert.match(newer.listingDraft.description, /文案样本第 18 段/u);
const mobileUrl = 'https://h5.m.goofish.com/item?id=1004';
const engines = process.env.OBI_LISTING_WEBKIT === '1' ? [chromium, webkit] : [chromium];
const screenshotCsp = "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

async function verifyMobile(context, filename) {
  const page = await context.newPage();
  const errors = [];
  let opened = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await context.route(mobileUrl, route => {
    opened++;
    return route.fulfill({body: '<title>固定样本商品</title>'});
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
  await sort.tap();
  await settle(page, ['.dd-list', '.shelf-page .grid']);
  assert.deepEqual(errors, []);
  await page.screenshot({caret: 'initial', path: join(output, `${filename}-sort.png`)});
  await pick('最近上架');
  assert.deepEqual(await order(), [newer.id, older.id]);
  await sort.tap();
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
  const button = manage.getByRole('button', {name: '打开闲鱼', exact: true});
  await button.waitFor();
  assert.equal(await manage.getByRole('heading', {name: '上架', exact: true}).count(), 0);
  assert.equal(await manage.getByText(newer.listingDraft.title, {exact: true}).count(), 0);
  assert.equal(await manage.getByRole('button', {name: '复制上架描述'}).count(), 0);
  assert.equal(await manage.locator('a[href*="goofish.com"]').count(), 0);
  assert.equal(await button.evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))), false);
  assert.equal(opened, 0);
  await button.scrollIntoViewIfNeeded();
  await settle(page, ['#panel', '.detail-page', '.listing-entry']);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({caret: 'initial', path: join(output, `${filename}-manage.png`)});
  await Promise.all([page.waitForURL(mobileUrl, {timeout: STEP_TIMEOUT}), button.tap()]);
  assert.equal(opened, 1);
  // WebKit 的截图实现有时会注入临时光标样式，站点 CSP 会拒绝它。
  assert.deepEqual(errors.filter(message => !filename.startsWith('webkit-') || message !== screenshotCsp), []);
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
      await verifyMobile(context, `${engine.name()}-${width}-${colorScheme}`);
      await context.close();
    }
  } catch (error) {
    await reportFailure(browser, output, `navigation-${engine.name()}`);
    throw error;
  } finally {await browser.close();}
}
console.log('长按菜单、商品跳转目标及上架顺序通过：' + engines.map(engine => engine.name()).join('、'));
