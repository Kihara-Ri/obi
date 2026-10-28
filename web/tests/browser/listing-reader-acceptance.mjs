// 长文展开的几何与输入验收；必须使用 --long-copy 固定样本服务，不临时伪造正文。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright';
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
      const context = await browser.newContext({viewport, hasTouch: viewport.width === 390});
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
      await page.goto(base + '/#overseas');
      await page.getByRole('button', {name: record.title, exact: true}).click();
      await page.getByRole('button', {name: '管理', exact: true}).click();
      await page.getByRole('button', {name: /编辑上架资料/u}).click();
      const toggle = page.getByRole('button', {name: /^(展开全文|收起全文)$/u});
      await toggle.waitFor();
      await page.waitForTimeout(450); // 等抽屉进场动画（0.22s）结束
      const box = selector => page.locator(selector).first().evaluate(el => {
        const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};
      });
      const collapsed = {copy: await box('.listing-copy'), photos: await box('.listing-photos'), footer: await box('.listing-footer')};
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.ok(collapsed.footer.y + collapsed.footer.height <= viewport.height + 1, '底栏始终在屏内');
      await shot(join(output, `${engine.name()}-${viewport.width}-collapsed.png`));
      // 就地展开：卡片增高、照片被推下，宽度与底栏不变，没有覆盖层。
      await toggle.click();
      await page.waitForTimeout(400);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.listing-copy-reader').count(), 0);
      const open = {copy: await box('.listing-copy'), photos: await box('.listing-photos'), footer: await box('.listing-footer')};
      assert.ok(open.copy.height > collapsed.copy.height + 50, '展开后卡片增高');
      assert.ok(Math.abs(open.copy.width - collapsed.copy.width) < 1, '展开不改变文字宽度');
      assert.ok(Math.abs(open.footer.y - collapsed.footer.y) < 1, '底栏不动');
      assert.equal(await page.getByRole('button', {name: '保存图片', exact: true}).isVisible(), true);
      assert.equal(await page.getByRole('button', {name: '复制文案', exact: true}).isVisible(), true);
      // 读到底部时收起条仍吸附在可视区内，随时可收。
      await page.locator('.listing-body').evaluate(el => {el.scrollTop = 200;});
      const sticky = await toggle.boundingBox();
      assert.ok(sticky.y >= 0 && sticky.y + sticky.height <= viewport.height, '收起条在可视区内');
      await page.locator('.listing-body').evaluate(el => {el.scrollTop = 0;});
      await shot(join(output, `${engine.name()}-${viewport.width}-expanded.png`));
      await toggle.click();
      await page.waitForTimeout(400);
      const back = {copy: await box('.listing-copy'), photos: await box('.listing-photos')};
      for (const item of ['copy', 'photos']) for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(Math.abs(back[item][key] - collapsed[item][key]) < 1, `${engine.name()} ${viewport.width} 收起后 ${item}.${key} 复原`);
      // 点正文本身同样展开 / 收起；选中文字时不误触。
      await page.locator('.listing-copy-clip').click({position: {x: 20, y: 20}});
      await page.waitForTimeout(350);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await page.locator('.listing-copy-clip').click({position: {x: 20, y: 20}});
      await page.waitForTimeout(350);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      // 减少动态效果：直接切换，几何一致。
      await page.emulateMedia({reducedMotion: 'reduce'});
      await toggle.click(); await page.waitForTimeout(50);
      assert.ok((await box('.listing-copy')).height > collapsed.copy.height + 50);
      await toggle.click(); await page.waitForTimeout(50);
      assert.ok(Math.abs((await box('.listing-copy')).height - collapsed.copy.height) < 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {await browser.close();}
}
console.log(JSON.stringify({passed: true, engines: engines.map(engine => engine.name()), screenshots: output}));
