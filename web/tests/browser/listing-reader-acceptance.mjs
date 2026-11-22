// 固定样本的历史长文案在手机和桌面均可完整阅读与复制。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';
import {fastFail, reportFailure, settle} from './acceptance-kit.mjs';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-browser';
await mkdir(output, {recursive: true});
const title = 'Lift Your Skinny Fists Like Antennas to Heaven';
const state = await (await fetch(base + '/api/state')).json();
const draft = state.records.find(r => r.title === title).listingDraft;
assert.match(draft.description, /阅读样本第 18 段/u);
const expected = [draft.title, draft.description].join('\n\n');
const engines = process.env.OBI_READER_WEBKIT === '1' ? [chromium, webkit] : [chromium];
const screenshotCsp = "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

for (const engine of engines) {
  const browser = await engine.launch({headless: true});
  try {
    for (const viewport of [{width: 390, height: 844}, {width: 1280, height: 900}]) {
      const context = fastFail(await browser.newContext({
        viewport, hasTouch: viewport.width === 390,
        permissions: engine === chromium ? ['clipboard-read', 'clipboard-write'] : [],
      }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
      await page.goto(base + '/#overseas');
      await page.getByRole('button', {name: title, exact: true}).click();
      await page.getByRole('button', {name: '管理', exact: true}).click();
      const copy = page.locator('.listing-description span');
      await copy.waitFor();
      await settle(page, ['#panel', '.detail-page', '.listing-description']);
      assert.equal(await copy.textContent(), expected);
      assert.ok(await copy.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const button = page.getByRole('button', {name: '复制上架描述', exact: true});
      await button.scrollIntoViewIfNeeded();
      assert.equal(await button.isVisible(), true);
      if (engine === chromium) {
        await button.click();
        await page.waitForFunction(async text => await navigator.clipboard.readText() === text, expected);
      }
      assert.deepEqual(errors, []);
      await page.screenshot({caret: 'initial', path: join(output, `${engine.name()}-${viewport.width}-history.png`)});
      // WebKit 的 Playwright 截图会临时设置光标样式，由站点 CSP 拒绝。
      assert.deepEqual(engine === webkit ? errors.filter(message => message !== screenshotCsp) : errors, []);
      await context.close();
    }
  } catch (error) {
    await reportFailure(browser, output, `reader-${engine.name()}`);
    throw error;
  } finally {await browser.close();}
}
console.log('历史文案阅读验收通过：' + engines.map(engine => engine.name()).join('、'));
