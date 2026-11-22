// 固定样本验收历史上架资料、详情原图包和账户入口。
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
  assert.equal(await listing.getByRole('link', {name: '打开商品页面 ↗'}).getAttribute('href'),
    'https://example.com/listing/1002');
  assert.equal(await listing.locator('.listing-description span').textContent(), '示例上架描述：碟面无划痕，附原装侧标。');
  assert.equal(await listing.locator('.detail-page').getByText('已上架', {exact: true}).isVisible(), true);
  assert.equal(await listing.locator('#panel').getByRole('button', {name: '编辑上架资料', exact: true}).count(), 0);
  await settle(listing, ['#panel', '.detail-page', '.listing-description']);
  await listing.screenshot({path: join(output, 'listing-history.png')});

  const settings = await openPage('settings');
  await settings.getByRole('button', {name: '账户', exact: true}).click();
  await settings.getByRole('heading', {name: '登录与安全', exact: true}).waitFor();
  assert.equal(await settings.getByText('已连接服务', {exact: true}).count(), 0);
  assert.deepEqual(errors, []);
  console.log('原图包、历史上架记录和账户页面通过');
} catch (error) {
  await reportFailure(browser, output, 'listing');
  throw error;
} finally {await browser.close();}
