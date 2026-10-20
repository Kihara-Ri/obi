// 售卖协议端到端验收：使用 serve_listing_acceptance.py 的模拟上游，不能据此声称真实模型效果。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.DIEDU_PREVIEW_SCREENSHOTS || '/tmp/diedu-listing-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1280, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
const title = 'Lift Your Skinny Fists Like Antennas to Heaven';
const state = async () => (await fetch(base + '/api/state')).json();
const before = (await state()).records.find(row => row.title === title);
assert.ok(before && before.photoCount === 4, '先运行固定版次参考照片初始化');
// 上架资料在「专辑详情 → 管理 → 编辑上架资料」（D-015）；从管理页进入，保存 / 取消后回到管理页。
const openFrom = async tab => {
  await tab.getByRole('button', {name: title, exact: true}).click();
  await tab.getByRole('button', {name: '管理', exact: true}).click();
  await tab.getByRole('button', {name: /编辑上架资料/}).click();
  await tab.getByRole('heading', {name: '售卖与上架资料'}).waitFor();
};
const open = () => openFrom(page);
try {
  await page.goto(base + '/#settings');
  await page.getByRole('button', {name: '高级', exact: true}).click();
  const provider = page.getByRole('combobox', {name: /^识别通道：/u});
  const pickProvider = async name => {
    await provider.click();
    await page.getByRole('option', {name, exact: true}).click();
    await page.waitForResponse(r => r.url().endsWith('/api/listing/status'));
  };
  await pickProvider('DeepSeek · API Key');
  await page.getByLabel('DeepSeek API Key', {exact: true}).fill('acceptance-deepseek-placeholder');
  await page.getByRole('button', {name: '保存 DeepSeek 连接', exact: true}).click();
  await page.getByRole('status').filter({hasText: '当前服务商已连接'}).waitFor();
  await page.getByRole('button', {name: '读取可用模型', exact: true}).click();
  await page.getByRole('combobox', {name: /^照片分析模型：/u}).click();
  assert.equal(await page.getByRole('option', {name: '验收文字模型 · 仅文字', exact: true}).getAttribute('aria-disabled'), 'true');
  await page.getByRole('option', {name: '验收图片模型', exact: true}).click();
  await page.getByRole('combobox', {name: /^思考强度：/u}).click();
  await page.getByRole('option', {name: '高', exact: true}).click();
  await page.waitForResponse(r => r.url().endsWith('/api/listing/status'));
  await pickProvider('OpenAI · ChatGPT OAuth');
  await page.getByRole('status').filter({hasText: '当前服务商尚未连接'}).waitFor();
  await pickProvider('Anthropic · Claude OAuth');
  await page.getByText(/通过官方 Claude Code 使用独立授权/u).waitFor();
  await pickProvider('DeepSeek · API Key');
  await page.getByRole('combobox', {name: '思考强度：高', exact: true}).waitFor();
  await page.reload();
  await page.getByRole('button', {name: '高级', exact: true}).click();
  await page.getByRole('combobox', {name: '思考强度：高', exact: true}).waitFor();
  assert.equal(await page.getByLabel('DeepSeek API Key', {exact: true}).inputValue(), '');
  await page.setViewportSize({width: 390, height: 844});
  await provider.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: join(output, 'providers-mobile.png')});
  await page.setViewportSize({width: 1280, height: 900});
  await pickProvider('OpenAI 兼容 API · 独立计费');
  await page.getByRole('status').filter({hasText: 'acceptance-only-model'}).waitFor();
  await pickProvider('DeepSeek · API Key');
  await page.getByRole('link', {name: /海外库存/u}).click();
  await open();
  await page.getByRole('textbox', {name: '售卖正文', exact: true}).fill('保留手写正文');
  await page.getByRole('button', {name: /^(重新)?分析本副本照片$/u}).click();
  await page.getByRole('button', {name: '重新分析本副本照片', exact: true}).waitFor();
  assert.equal(await page.getByRole('textbox', {name: '售卖正文', exact: true}).inputValue(), '保留手写正文');
  assert.equal(await page.getByRole('button', {name: '用已确认信息生成正文'}).isDisabled(), true);
  await page.getByRole('button', {name: '采用照片观察到品相说明'}).click();
  await page.getByRole('textbox', {name: '版本说明（不确定的内容留空）', exact: true}).fill('');
  await page.getByRole('checkbox', {name: '已核对版本说明，未确定的信息已留空'}).check();
  await page.getByRole('checkbox', {name: '已核对品相与附件；试听情况由我确认'}).check();
  await page.getByRole('textbox', {name: '售卖正文', exact: true}).fill('');
  await page.getByRole('button', {name: '用已确认信息生成正文'}).click();
  const description = await page.getByRole('textbox', {name: '售卖正文', exact: true}).inputValue();
  assert.match(description, /固定模型响应/u);
  assert.ok(!description.includes('需使用实拍重新分析和试听'), '待确认项不能混入正文');
  await page.getByRole('button', {name: '复制售卖文案'}).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Godspeed You! Black Emperor/u);
  // 照片不在上架资料里：保存草稿后到专辑详情，用“实物照片”右侧图标下载。
  assert.equal(await page.getByRole('button', {name: '下载所选图片包'}).count(), 0);
  await page.getByRole('button', {name: '保存草稿', exact: true}).click();
  // 保存成功后回到上一层（管理页），不关闭抽屉
  await page.getByRole('heading', {name: '管理', exact: true}).waitFor();
  const saved = (await state()).records.find(row => row.id === before.id);
  assert.equal(Boolean(saved.listed), Boolean(before.listed));
  assert.equal(saved.price, before.price);
  assert.equal(saved.listingDraft.description, description);
  assert.deepEqual(saved.listingDraft.photoOrder, [0, 1, 2, 3]);
  // 桌面：专辑详情“实物照片”右侧图标下载按专辑命名的 ZIP。管理页返回详情（返回箭头）。
  await page.getByRole('button', {name: '返回专辑详情', exact: true}).click();
  await page.getByRole('heading', {name: '专辑详情', exact: true}).waitFor();
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', {name: '下载实物照片'}).click();
  const download = await downloadWait;
  assert.equal(await download.failure(), null);
  await download.saveAs(join(output, 'listing-photos.zip'));
  await page.getByRole('button', {name: '关闭', exact: true}).click();
  await page.getByRole('heading', {name: '专辑详情'}).waitFor({state: 'hidden'});
  await open();
  assert.equal(await page.getByRole('textbox', {name: '售卖正文', exact: true}).inputValue(), description);
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: join(output, 'listing-mobile.png')});
  // 另一标签真实保存新草稿；返回旧标签不能借刷新覆盖。
  const other = await context.newPage();
  await other.goto(base + '/#overseas');
  await openFrom(other);
  await other.getByRole('textbox', {name: '售卖正文', exact: true}).fill('另一标签保存的正文');
  await other.getByRole('button', {name: '保存草稿', exact: true}).click();
  await other.getByRole('heading', {name: '管理', exact: true}).waitFor();
  await page.bringToFront();
  // headless 不保证派发标签可见性事件；不伪造刷新，以真实保存响应核对并发保护。
  if (await page.getByRole('button', {name: '保存草稿', exact: true}).isEnabled()) {
    const conflictWait = page.waitForResponse(response => response.url().endsWith('/api/listing/draft'));
    await page.getByRole('button', {name: '保存草稿', exact: true}).click();
    assert.equal((await conflictWait).status(), 400);
    await page.getByRole('alert').filter({hasText: '记录已变更'}).waitFor();
  }

  assert.equal((await state()).records.find(row => row.id === before.id).listingDraft.description, '另一标签保存的正文');
  assert.deepEqual(errors.filter(message => !message.includes('400 (Bad Request)')), []);
  console.log(JSON.stringify({passed: true, screenshots: output, liveModel: false, liveOAuth: false}));
} finally {await browser.close();}
