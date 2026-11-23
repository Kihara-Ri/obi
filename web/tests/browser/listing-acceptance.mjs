// 固定样本验收历史商品链接、详情原图包和账户入口。
import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {fastFail, reportFailure, settle} from './acceptance-kit.mjs';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = fastFail(await browser.newContext({viewport: {width: 1280, height: 900}}));
const errors = [];
const openPage = async route => {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await page.goto(base + '/#' + route);
  return page;
};
const manage = async page => {
  await page.getByRole('button', {name: '管理', exact: true}).click();
  await page.getByRole('heading', {name: '管理', exact: true}).waitFor();
};
try {
  const photos = await openPage('overseas');
  await photos.getByRole('button', {name: 'Lift Your Skinny Fists Like Antennas to Heaven', exact: true}).click();
  const archive = photos.waitForResponse(response => new URL(response.url()).pathname === '/api/photos/archive');
  const saved = photos.waitForEvent('download');
  await photos.getByRole('button', {name: '下载实物照片', exact: true}).click();
  assert.equal((await archive).status(), 200);
  const download = await saved;
  assert.equal(download.suggestedFilename(), 'album-photos.zip');
  const zip = await readFile(await download.path());
  assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304');
  assert.match(zip.toString('latin1'), / - 04\.jpg/u);
  await manage(photos);
  assert.equal(await photos.locator('#panel').getByRole('button', {name: /编辑上架资料|AI 生成上架资料/u}).count(), 0);

  const listing = await openPage('domestic');
  await listing.getByRole('button', {name: 'Parachutes', exact: true}).click();
  await manage(listing);
  const panel = listing.locator('.detail-page');
  const website = panel.getByRole('link', {name: '打开商品页面 ↗', exact: true});
  await website.waitFor();
  assert.equal(await panel.getByRole('heading', {name: '上架', exact: true}).count(), 1);
  const rows = panel.locator('dl').filter({has: listing.getByText('链接', {exact: true})});
  assert.deepEqual(await rows.locator('dt').allTextContents(), ['状态', '平台', '链接']);
  assert.equal(await rows.locator('dd').first().textContent(), '已上架');
  await rows.getByText('示例二手平台', {exact: true}).waitFor();
  assert.equal(await rows.locator('.shop-mark-inline[aria-hidden="true"] .shop-letter').textContent(), '示');
  const savedUrl = 'https://example.com/listing/1002';
  assert.equal(await website.getAttribute('href'), savedUrl);
  await context.route(savedUrl, route => route.fulfill({body: '<title>固定样本商品</title>'}));
  const [popup] = await Promise.all([context.waitForEvent('page'), website.click()]);
  await popup.waitForURL(savedUrl);
  await popup.close();
  await settle(listing, ['#panel', '.detail-page']);
  await listing.screenshot({path: join(output, 'listing-website.png')});

  const unlisted = await openPage('domestic');
  await unlisted.getByRole('button', {name: 'Minecraft: Volume Alpha', exact: true}).click();
  await manage(unlisted);
  const unlistedSection = unlisted.locator('.detail-page');
  await unlistedSection.getByRole('heading', {name: '上架', exact: true}).waitFor();
  const unlistedRows = unlistedSection.locator('dl').filter({has: unlisted.getByText('未上架', {exact: true})});
  assert.deepEqual(await unlistedRows.locator('dt').allTextContents(), ['状态']);
  assert.deepEqual(await unlistedRows.locator('dd').allTextContents(), ['未上架']);
  assert.equal(await unlistedSection.getByText('平台', {exact: true}).count(), 0);
  assert.equal(await unlistedSection.getByText('链接', {exact: true}).count(), 0);
  await settle(unlisted, ['#panel', '.detail-page']);
  await unlisted.screenshot({path: join(output, 'listing-unlisted.png')});

  const latestCopy = async () => (await (await fetch(base + '/api/state')).json()).records
    .find(r => r.title === 'Minecraft: Volume Alpha');
  await unlisted.getByRole('button', {name: '返回专辑详情', exact: true}).click();
  await unlisted.getByRole('button', {name: '上架', exact: true}).click();
  await unlisted.getByRole('heading', {name: '标记上架', exact: true}).waitFor();
  const form = unlisted.locator('#listing-form');
  assert.equal(Boolean((await latestCopy()).listed), false);
  await form.getByLabel('平台', {exact: true}).fill('闲鱼');
  const itemUrl = 'https://www.goofish.com/item?id=1006';
  await form.getByLabel('商品链接', {exact: true}).fill(itemUrl);
  await form.getByRole('button', {name: '确认上架', exact: true}).click();
  await unlisted.getByRole('button', {name: '关闭', exact: true}).waitFor({state: 'detached'});
  const marked = await latestCopy();
  assert.deepEqual([marked.listed, marked.listingChannel, marked.listingUrl], [true, '闲鱼', itemUrl]);

  await unlisted.getByRole('button', {name: 'Minecraft: Volume Alpha', exact: true}).click();
  await manage(unlisted);
  await unlistedSection.getByRole('button', {name: '编辑上架信息', exact: true}).click();
  await unlisted.getByRole('heading', {name: '编辑上架信息', exact: true}).waitFor();
  const channel = form.getByLabel('平台', {exact: true});
  const url = form.getByLabel('商品链接', {exact: true});
  assert.equal(await channel.inputValue(), '闲鱼');
  assert.equal(await url.inputValue(), itemUrl);
  await channel.fill('示例二手平台');
  const newUrl = 'https://example.com/listing/1006';
  await url.fill(newUrl);
  await form.getByRole('button', {name: '保存', exact: true}).click();
  await unlisted.getByRole('heading', {name: '管理', exact: true}).waitFor();
  await unlistedSection.getByText('示例二手平台', {exact: true}).waitFor();
  assert.equal(await unlistedSection.getByRole('link', {name: '打开商品页面 ↗', exact: true}).getAttribute('href'), newUrl);
  const updated = await latestCopy();
  assert.deepEqual([updated.listed, updated.listingOrder, updated.listingChannel, updated.listingUrl],
                   [true, marked.listingOrder, '示例二手平台', newUrl]);

  const settings = await openPage('settings');
  await settings.getByRole('button', {name: '账户', exact: true}).click();
  await settings.getByRole('heading', {name: '登录与安全', exact: true}).waitFor();
  assert.equal(await settings.getByText('已连接服务', {exact: true}).count(), 0);
  assert.deepEqual(errors, []);
  console.log('原图包、平台图标、手动上架和编辑、历史商品链接及账户页面通过');
} catch (error) {
  await reportFailure(browser, output, 'listing');
  throw error;
} finally {await browser.close();}
