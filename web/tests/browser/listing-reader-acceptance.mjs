// 长文展开的几何与输入验收；必须使用 --long-copy 固定样本服务，不临时伪造正文。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';
import {fastFail, reportFailure, settle as settleOn} from './acceptance-kit.mjs';
const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u);
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-reader-shots';
await mkdir(output, {recursive: true});
const record = (await (await fetch(base + '/api/state')).json()).records.find(r => r.title === 'Lift Your Skinny Fists Like Antennas to Heaven');
assert.ok(record.listingDescription.includes('阅读样本第 18 段'), '先用固定样本 --long-copy 初始化');
// Playwright 在 WebKit 截图时会注入一张隐藏光标用的样式表，CSP 会据此记录一次样式拒绝；
// 只忽略截图期间出现的这一条固定文案，其他 console/pageerror 仍按零错误处理。
const SCREENSHOT_CSP = 'Refused to apply a stylesheet because its hash, its nonce, or \'unsafe-inline\' does not appear in the style-src directive of the Content Security Policy.';
const engines = process.env.OBI_READER_WEBKIT === '1' ? [chromium, webkit] : [chromium];
for (const engine of engines) {
  const browser = await engine.launch({headless: true});
  try {
    for (const viewport of [{width: 390, height: 844}, {width: 1280, height: 900}]) {
      const context = fastFail(await browser.newContext({viewport, hasTouch: viewport.width === 390}));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', e => {if (e.type() === 'error') errors.push(e.text());});
      const shot = async path => {
        const before = errors.length;
        await page.screenshot({caret: 'initial', path});
        await page.waitForTimeout(30);
        const kept = errors.slice(before).filter(text => text !== SCREENSHOT_CSP);
        errors.splice(before, errors.length - before, ...kept);
      };
      // 抽屉进场（slide/sheet-up）与卡片限高都带过渡：量几何前要求卡片、照片、底栏三块矩形
      // 连续 200ms 不变且没有动画在跑，否则会量到进场途中（桌面端 x 偏移几 px、手机端照片还在上移）。
      const settle = () => settleOn(page, ['.listing-copy', '.listing-photos', '.listing-footer']);
      await page.goto(base + '/#overseas');
      await page.getByRole('button', {name: record.title, exact: true}).click();
      await page.getByRole('button', {name: '管理', exact: true}).click();
      await page.getByRole('button', {name: /编辑上架资料/u}).click();
      // 文案始终全文：没有展开 / 收起，点正文不改变布局（可正常选字）。
      await page.locator('.listing-copy-text').waitFor();
      await settle();
      const box = selector => page.locator(selector).first().evaluate(el => {
        const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};
      });
      assert.equal(await page.getByRole('button', {name: /^(展开全文|收起全文)$/u}).count(), 0);
      const text = await page.locator('.listing-copy-preview').evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
      assert.ok(text.scroll <= text.client + 1, '正文不被裁切');
      const before = {copy: await box('.listing-copy'), footer: await box('.listing-footer')};
      assert.ok(before.footer.y + before.footer.height <= viewport.height + 1, '底栏始终在屏内');
      assert.equal(await page.getByRole('button', {name: '复制文案', exact: true}).isVisible(), true);
      await page.locator('.listing-copy-text').click({position: {x: 20, y: 20}});
      await settle();
      const after = await box('.listing-copy');
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(after[key] - before.copy[key]) < 1, `点正文后 ${key} 不变`);
      // 重新生成：就地展开生成面板（风格与本次补充），取消收回。
      await page.getByRole('button', {name: '重新生成', exact: true}).click();
      await page.getByRole('textbox', {name: /^本次补充/u}).waitFor();
      await settle();
      await shot(join(output, `${engine.name()}-${viewport.width}-panel.png`));
      await page.locator('.listing-copy-panel-actions').getByRole('button', {name: '取消', exact: true}).click();
      await settle();
      assert.ok(Math.abs((await box('.listing-copy')).height - before.copy.height) < 1, '取消后面板收回');
      await shot(join(output, `${engine.name()}-${viewport.width}-reading.png`));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } catch (error) {
    await reportFailure(browser, output, `reader-${engine.name()}`);
    throw error;
  } finally {await browser.close();}
}
console.log(JSON.stringify({passed: true, engines: engines.map(engine => engine.name()), screenshots: output}));
