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
      const trigger = page.getByRole('button', {name: '展开全文', exact: true});
      await trigger.waitFor();
      await page.waitForTimeout(100);
      await page.locator('#panel').evaluate(async panel => {
        const finite = panel.getAnimations({subtree: true}).filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
        await Promise.all(finite.map(animation => animation.finished.catch(() => undefined)));
      });
      const geometry = () => page.evaluate(() => {
        const pick = selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return {x: box.x, y: box.y, width: box.width, height: box.height};
        };
        return {copy: pick('.listing-copy'), photos: pick('.listing-photos'), footer: pick('.listing-footer'),
          scroll: document.querySelector('.listing-body').scrollTop};
      });
      const original = await geometry();
      const assertStable = async () => {
        const current = await geometry();
        for (const item of ['copy', 'photos', 'footer']) for (const key of ['x', 'y', 'width', 'height'])
          assert.ok(Math.abs(current[item][key] - original[item][key]) < 1, `${engine.name()} ${viewport.width} ${item}.${key} 保持不动`);
        assert.equal(current.scroll, original.scroll, '原页面不跟随阅读滚动');
      };
      await shot(join(output, `${engine.name()}-${viewport.width}-collapsed.png`));
      await trigger.click();
      const reader = page.getByRole('region', {name: '文案全文', exact: true});
      await reader.waitFor();
      assert.equal(await page.locator('.listing-body').evaluate(el => el.inert), true);
      for (const delay of [25, 60, 130]) {await page.waitForTimeout(delay); await assertStable();}
      const readerBox = await reader.boundingBox();
      assert.ok(Math.abs(readerBox.x - original.copy.x) < 1);
      assert.ok(Math.abs(readerBox.width - original.copy.width) < 1, '展开不改变文字宽度');
      assert.ok(readerBox.y + readerBox.height <= original.footer.y + 1, '不覆盖底部操作');
      assert.equal(await page.getByRole('button', {name: '保存图片', exact: true}).isVisible(), true);
      assert.equal(await page.getByRole('button', {name: '复制文案', exact: true}).isVisible(), true);
      const scroller = page.getByLabel('完整文案内容', {exact: true});
      await scroller.evaluate(el => {el.scrollTop = el.scrollHeight;});
      await assertStable();
      await page.getByRole('button', {name: '收起全文', exact: true}).click();
      await page.waitForTimeout(50); await assertStable();
      await reader.waitFor({state: 'detached'}); await assertStable();
      assert.equal(await page.locator('.listing-body').evaluate(el => el.inert), false);
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true, '收起恢复原焦点且不滚动');
      // 快速反向操作在展开动画中途接管，不重新排版。
      for (let i = 0; i < 3; i++) {
        await trigger.click();
        await page.getByRole('button', {name: '收起全文', exact: true}).click();
        await reader.waitFor({state: 'detached'}); await assertStable();
      }
      await trigger.focus(); await page.keyboard.press('Enter');
      await page.waitForTimeout(230);
      await shot(join(output, `${engine.name()}-${viewport.width}-expanded.png`));
      await page.keyboard.press('Escape'); await reader.waitFor({state: 'detached'}); await assertStable();
      assert.equal(await page.getByRole('heading', {name: '售卖与上架资料'}).isVisible(), true, 'Esc 只收起阅读层');
      await page.emulateMedia({reducedMotion: 'reduce'});
      await trigger.click(); await page.getByRole('button', {name: '收起全文', exact: true}).click();
      await reader.waitFor({state: 'detached'}); await assertStable();
      // 原页面已滚动时，展开与收起仍不改它的滚动值。
      await page.locator('.listing-body').evaluate(el => {el.scrollTop = 30;});
      const scrolled = await page.locator('.listing-body').evaluate(el => el.scrollTop);
      await trigger.click();
      await page.getByRole('button', {name: '收起全文', exact: true}).click(); await reader.waitFor({state: 'detached'});
      assert.equal(await page.locator('.listing-body').evaluate(el => el.scrollTop), scrolled);
      await page.locator('.listing-body').evaluate(el => {el.scrollTop = 0;});
      await trigger.click(); await page.setViewportSize({width: 844, height: 390});
      await page.waitForTimeout(100);
      const resized = await reader.boundingBox();
      const source = await page.locator('.listing-copy').boundingBox();
      assert.ok(Math.abs(resized.width - source.width) < 1, '旋转后仍对齐原宽度');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', {name: '收起全文', exact: true}).click(); await reader.waitFor({state: 'detached'});
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {await browser.close();}
}
console.log(JSON.stringify({passed: true, engines: engines.map(engine => engine.name()), screenshots: output}));
