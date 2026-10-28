// 售卖协议端到端验收：使用 serve_listing_acceptance.py 的模拟上游，不能据此声称真实模型效果。
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const base = process.env.LISTING_ACCEPTANCE_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/u, '只允许隔离本机验收服务');
const output = process.env.OBI_PREVIEW_SCREENSHOTS || '/tmp/obi-listing-browser';
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
  // 设置 · 高级 · 视觉模型接口：服务商列表 → 点进详情抽屉完成密钥 / 模型 / 设为在用（D-013）。
  const openSettings = async () => {
    await page.goto(base + '/#settings');
    await page.getByRole('button', {name: '高级', exact: true}).click();
    await page.getByRole('heading', {name: '视觉模型接口', exact: true}).waitFor();
  };
  const openProvider = async name => {
    const row = page.locator('.provider-item').filter({has: page.locator('b', {hasText: new RegExp(`^${name}$`, 'u')})});
    // 收起的折叠区仍挂载（高度 0、透明度 0），isVisible() 会误判为可见；按所在折叠区是否展开来决定，
    // 并先等列表读完，避免在「正在读取识别配置…」时判断。
    await row.waitFor({state: 'attached'});
    const stack = page.locator('.provider-stack');
    if (await row.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " collapse ")]').count()
        && await stack.getAttribute('aria-expanded') !== 'true') {
      await stack.click();
      await page.locator('.listing-settings .collapse.is-open').waitFor();
    }
    await row.click();
    await page.getByRole('heading', {name, exact: true, level: 3}).waitFor();
  };
  const closeProvider = async () => {
    await page.getByRole('button', {name: '关闭', exact: true}).click();
    await page.locator('.provider-page').waitFor({state: 'hidden'});
  };
  await openSettings();
  await openProvider('DeepSeek');
  await page.getByLabel('DeepSeek API Key', {exact: true}).fill('acceptance-deepseek-placeholder');
  await page.getByRole('button', {name: '保存密钥', exact: true}).click();
  await page.getByRole('button', {name: '读取可用模型', exact: true}).click();
  await page.getByRole('combobox', {name: /^照片分析模型：/u}).click();
  assert.equal(await page.getByRole('option', {name: '验收文字模型 · 仅文字', exact: true}).getAttribute('aria-disabled'), 'true');
  await page.getByRole('option', {name: '验收图片模型', exact: true}).click();
  await page.getByRole('combobox', {name: /^思考强度：/u}).click();
  await page.getByRole('option', {name: '高', exact: true}).click();
  await page.getByRole('combobox', {name: '思考强度：高', exact: true}).waitFor();
  const use = page.getByRole('button', {name: '设为分析在用', exact: true});
  if (await use.count()) await use.click();
  await page.locator('.provider-head .badge-use').waitFor();
  await closeProvider();
  // OpenCode：Go 订阅与按量余额共用 Console 密钥，模型目录按通道隔离；目录不声明图片能力。
  await openProvider('OpenCode');
  await page.getByLabel('OpenCode API Key', {exact: true}).fill('acceptance-opencode-placeholder');
  await page.getByRole('button', {name: '保存密钥', exact: true}).click();
  await page.getByRole('button', {name: '读取可用模型', exact: true}).click();
  await page.getByRole('combobox', {name: /^照片分析模型：/u}).click();
  await page.getByRole('option', {name: 'acceptance-open-model', exact: true}).click();
  await page.getByText('目录未声明图片能力，实际可用性以服务商响应为准。', {exact: true}).waitFor();
  await page.getByRole('button', {name: '测试连接', exact: true}).click();
  await page.getByText(/读取模型目录成功/u).waitFor();
  await page.getByRole('button', {name: '按量余额', exact: true}).click();
  await page.locator('.provider-page').getByText('尚未读取', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Go 订阅', exact: true}).click();
  await page.getByRole('button', {name: '刷新模型列表', exact: true}).waitFor();
  await page.locator('.provider-head .badge-use').waitFor();
  await closeProvider();
  // 恢复 DeepSeek 为分析在用，后续分析仍走模拟 Chat Completions 上游。
  await openProvider('DeepSeek');
  await page.getByRole('button', {name: '设为分析在用', exact: true}).click();
  await closeProvider();
  await openProvider('OpenAI · ChatGPT');
  await page.getByRole('status').filter({hasText: '尚未授权'}).waitFor();
  await closeProvider();
  await openProvider('Anthropic · Claude');
  await page.getByText(/通过官方 Claude Code 使用独立授权/u).waitFor();
  await closeProvider();
  await openProvider('OpenAI 兼容 API');
  await page.getByRole('status').filter({hasText: 'acceptance-only-model'}).waitFor();
  await closeProvider();
  // 刷新后仍保留：DeepSeek 在用、思考强度；密钥只显示末四位，不回传原文
  await openSettings();
  assert.equal(await page.locator('.provider-list').first().locator('b').first().textContent(), 'DeepSeek');
  await openProvider('DeepSeek');
  await page.getByRole('combobox', {name: '思考强度：高', exact: true}).waitFor();
  assert.equal(await page.getByLabel('DeepSeek API Key', {exact: true}).count(), 0);
  assert.ok(!(await page.getByLabel('已保存的密钥').textContent()).includes('acceptance-deepseek'));
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: join(output, 'providers-mobile.png')});
  await page.setViewportSize({width: 1280, height: 900});
  await closeProvider();
  await page.getByRole('link', {name: /海外库存/u}).click();
  await open();
  await page.getByRole('textbox', {name: '售卖正文', exact: true}).fill('保留手写正文');
  await page.getByRole('button', {name: /^(开始|重新)分析$/u}).click();
  await page.getByRole('button', {name: '重新分析', exact: true}).waitFor();
  assert.equal(await page.getByRole('textbox', {name: '售卖正文', exact: true}).inputValue(), '保留手写正文');
  assert.equal(await page.getByRole('button', {name: '用已确认信息生成正文'}).isDisabled(), true);
  await page.getByRole('button', {name: '采用照片观察到的品相说明'}).click();
  await page.getByRole('textbox', {name: /^版本说明/u}).fill('');
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
