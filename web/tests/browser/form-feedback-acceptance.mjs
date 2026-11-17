// 使用隔离固定样本，验证手机 / 桌面抽屉里的字段定位和保存失败反馈。
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.env.OBI_FORM_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u);
const browser = await chromium.launch({headless: true});
const failures = [];

async function visibleInBody(page, selector) {
  const positions = await page.locator(selector).evaluate(el => {
    const body = el.closest('.drawer-body').getBoundingClientRect(), box = el.getBoundingClientRect();
    return {top: box.top - body.top, bottom: body.bottom - box.bottom};
  });
  assert.ok(positions.top >= -1 && positions.bottom >= -1, JSON.stringify(positions));
}

async function setField(page, selector, value) {
  const field = page.locator(selector);
  const floating = await field.evaluate(el => el.readOnly || (el.tagName === 'TEXTAREA' && matchMedia('(max-width:840px)').matches));
  if (floating) {
    await field.click();
    const dialog = page.getByRole('dialog').last();
    await dialog.locator('input,textarea').fill(value);
    await dialog.getByRole('button', {name: '完成', exact: true}).click();
  } else await field.fill(value);
}

async function openRecord(page) {
  await page.getByRole('button', {name: 'Islands', exact: true}).click();
  await page.locator('#panel').getByRole('button', {name: '编辑', exact: true}).click();
  await page.locator('#record-form').waitFor();
  await page.waitForTimeout(550);
}

try {
  for (const mobile of [true, false]) {
    const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 900},
      isMobile: mobile, hasTouch: mobile});
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    page.on('console', message => {if (message.type() === 'error' && !message.text().includes('400 (Bad Request)')) failures.push(message.text());});
    await page.goto(base + '/');
    await page.getByRole('button', {name: '添加专辑', exact: true}).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', {name: '国内库存', exact: true}).click();
    await page.locator('#record-form .drawer-body').hover();
    await page.mouse.wheel(0, 2000);
    await page.getByRole('button', {name: '保存并入库', exact: true}).click();
    await page.getByText('请先通过条码或唱片编号匹配发行版', {exact: true}).waitFor();
    await visibleInBody(page, '.form-field-error');
    await page.getByRole('button', {name: '保存并入库', exact: true}).click();
    assert.equal(await page.locator('.form-field-error').count(), 1);
    await page.getByRole('button', {name: /按未收录版本手动录入/u}).click();
    await page.waitForTimeout(250);
    await page.getByRole('button', {name: '保存并入库', exact: true}).click();
    await page.getByText('请填写专辑名', {exact: true}).waitFor();
    await setField(page, '#f-title', 'Islands');
    await page.locator('.form-field-error').waitFor({state: 'detached'});
    // 固定样本会按专辑名自动带入艺人，清空后才能验证独立的必填提示。
    await setField(page, '#f-artist', '');
    await page.getByRole('button', {name: '保存并入库', exact: true}).click();
    await page.getByText('请填写艺人', {exact: true}).waitFor();
    await setField(page, '#f-artist', 'King Crimson');
    await page.getByRole('button', {name: '保存并入库', exact: true}).click();
    await page.getByText('请选择这张专辑的实物包装后保存', {exact: true}).waitFor();
    await visibleInBody(page, '.form-field-error');
    await page.locator('#record-packaging').getByRole('radio', {name: '标准塑料盒', exact: true}).click();
    await page.locator('.form-field-error').waitFor({state: 'detached'});
    await context.close();

    const next = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 900},
      isMobile: mobile, hasTouch: mobile});
    const tab = await next.newPage();
    tab.on('pageerror', error => failures.push(error.message));
    tab.on('console', message => {if (message.type() === 'error' && !message.text().includes('400 (Bad Request)')) failures.push(message.text());});
    await tab.goto(base + '/');
    await openRecord(tab);
    await setField(tab, '#f-note', '示例：验收字段提示');
    await tab.getByRole('button', {name: '保存修改', exact: true}).click();
    await tab.getByText('日版请选择这张副本是带侧标还是无侧标', {exact: true}).waitFor();
    await visibleInBody(tab, '.form-field-error');
    const group = tab.locator('.record-copy-edition [role=group]');
    assert.equal(await group.getAttribute('aria-invalid'), 'true');
    await group.getByRole('button', {name: '无侧标'}).click();
    await tab.locator('.form-field-error').waitFor({state: 'detached'});
    await tab.route('**/api/records/metadata', route => route.fulfill({status: 400, contentType: 'application/json', body: '{"error":"验收保存失败"}'}));
    await tab.getByRole('button', {name: '保存修改', exact: true}).click();
    await tab.locator('.form-footer-error').getByText('验收保存失败').waitFor();
    assert.equal(await tab.locator('#record-form').count(), 1);
    await next.close();

    const saleContext = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 900},
      isMobile: mobile, hasTouch: mobile});
    const sale = await saleContext.newPage();
    sale.on('pageerror', error => failures.push(error.message));
    sale.on('console', message => {if (message.type() === 'error') failures.push(message.text());});
    await sale.goto(base + '/');
    await sale.getByRole('button', {name: 'Islands', exact: true}).click();
    await sale.locator('#panel').getByRole('button', {name: '记录售出', exact: true}).click();
    await sale.waitForTimeout(300);
    await sale.locator('#sale-form button[type=submit]').click();
    await sale.getByText('请填写此项', {exact: true}).waitFor();
    assert.equal(await sale.locator('#f-gross').getAttribute('aria-invalid'), 'true');
    await visibleInBody(sale, '.form-field-error');
    await setField(sale, '#f-gross', '120');
    await sale.locator('.form-field-error').waitFor({state: 'detached'});
    await saleContext.close();
  }
  assert.deepEqual(failures, []);
  console.log('手机与桌面：发行版、必填、包装、侧标、金额、保存失败提示通过');
} finally {await browser.close();}
