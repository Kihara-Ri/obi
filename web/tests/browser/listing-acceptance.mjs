// 固定样本与模拟 HTTP 上游验证一键准备与多服务商设置；不作为真实模型效果或 OAuth 验收。
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
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
const state = async () => (await fetch(base + '/api/state')).json();
const post = async (path, data) => {
  const response = await fetch(base + '/api/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
};
const openFrom = async (tab, title) => {
  await tab.getByRole('button', {name: title, exact: true}).click();
  await tab.getByRole('button', {name: '管理', exact: true}).click();
  await tab.getByRole('button', {name: /编辑上架资料/u}).click();
  await tab.getByRole('heading', {name: '售卖与上架资料'}).waitFor();
  await tab.locator('.listing-copy').waitFor();
};
const closeDrawer = async () => {
  // 等关闭动画与 history.go 完成后再换路由，否则异步返回会撤销刚写入的新 hash。
  await page.waitForTimeout(250);
  const restored = page.evaluate(() => new Promise(resolve => window.addEventListener('popstate', () => resolve(true), {once: true})));
  await page.getByRole('button', {name: '关闭', exact: true}).click();
  await restored; await page.locator('#panel').waitFor({state: 'detached'});
};
const generate = async () => {
  await page.getByRole('button', {name: /^(AI 生成上架资料|重新生成)$/u}).click();
  // 已有草稿时“已保存”标题一直在，不能拿标题当完成信号；先等忙碌态出现，再等按钮恢复。
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('button')].find(node => /^(AI 生成上架资料|重新生成)$/u.test(node.textContent.trim()));
    return !el || el.disabled;
  });
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('button')].find(node => /^(AI 生成上架资料|重新生成)$/u.test(node.textContent.trim()));
    return !!el && !el.disabled;
  });
};
try {
  // 设置 · 账户 · 已连接服务（视觉模型）：服务商列表 → 点进详情抽屉完成密钥 / 模型 / 设为在用（D-013）。
  const openSettings = async () => {
    await page.goto(base + '/#settings');
    await page.getByRole('button', {name: '账户', exact: true}).click();
    await page.getByRole('heading', {name: '已连接服务', exact: true}).waitFor();
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
  const ensureKey = async (label, value) => {
    const input = page.getByLabel(label, {exact: true});
    if (!await input.count()) return;
    await input.fill(value);
    await page.getByRole('button', {name: '保存密钥', exact: true}).click();
  };
  await openSettings();
  await openProvider('DeepSeek');
  await ensureKey('DeepSeek API Key', 'acceptance-deepseek-placeholder');
  await page.getByRole('button', {name: /^(读取可用模型|刷新模型列表)$/u}).click();
  await page.getByRole('combobox', {name: /^售卖辅助模型：/u}).click();
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
  await ensureKey('OpenCode API Key', 'acceptance-opencode-placeholder');
  await page.getByRole('button', {name: /^(读取可用模型|刷新模型列表)$/u}).click();
  await page.getByRole('combobox', {name: /^售卖辅助模型：/u}).click();
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
  // 刷新后仍保留：DeepSeek 在用、思考强度；密钥只显示末四位，不回传原文。
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
  // 无照片场景只用文字模型：目录里选择仅文字模型，后面再切视觉模型。
  await page.getByRole('combobox', {name: /^售卖辅助模型：/u}).click();
  await page.getByRole('option', {name: '验收文字模型 · 仅文字', exact: true}).click();
  await page.getByRole('combobox', {name: '售卖辅助模型：验收文字模型 · 仅文字', exact: true}).waitFor();
  await closeProvider();
  await page.goto(base + '/#domestic');
  const before = (await state()).records.find(r => r.title === 'Dookie' && r.status === 'domestic');
  assert.equal(before.photoCount, 0);
  await openFrom(page, 'Dookie');
  await page.getByText('尚未上传实物照片，可先生成文案。', {exact: true}).waitFor();
  await generate();
  await page.getByRole('heading', {name: '售卖文案 · 已保存', exact: true}).waitFor();
  const saved = (await state()).records.find(r => r.id === before.id);
  assert.ok(!saved.listingDraft.description.includes('尚未核实'), '内部待核实标记不得进入买家可见文案');
  assert.equal(saved.price, before.price); assert.equal(saved.listed, before.listed);
  assert.deepEqual(saved.releaseInfo, before.releaseInfo);
  assert.equal(await page.locator('#panel').getByRole('checkbox').count(), 0);
  // 真正读取剪贴板；手动修改后再生成，原稿不受影响，采用才保存。
  await page.getByRole('button', {name: '复制文案', exact: true}).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Green Day/u);
  await page.getByRole('button', {name: '编辑', exact: true}).click();
  await page.getByRole('textbox', {name: '售卖正文', exact: true}).fill('保留手写正文');
  await generate();
  await page.getByRole('region', {name: '新文案候选'}).waitFor();
  assert.match(await page.locator('.listing-copy-preview').innerText(), /模拟写作/u);
  assert.equal((await state()).records.find(r => r.id === before.id).listingDraft.description, saved.listingDraft.description);
  await page.getByRole('button', {name: '保留原稿', exact: true}).click();
  assert.equal(await page.getByRole('textbox', {name: '售卖正文', exact: true}).inputValue(), '保留手写正文');
  await page.getByRole('button', {name: '保存草稿', exact: true}).click();
  await page.getByRole('heading', {name: '管理', exact: true}).waitFor();
  await page.getByRole('button', {name: /编辑上架资料/u}).click();
  assert.match(await page.locator('.listing-copy-preview').innerText(), /保留手写正文/u);
  // 自定义风格保存即成为全局默认，换风格后候选采用保存。
  await page.getByText('生成设置', {exact: true}).click();
  await page.getByRole('combobox', {name: /^文案风格：/u}).click();
  await page.getByRole('option', {name: '＋ 我的风格', exact: true}).click();
  await page.getByRole('button', {name: '友好', exact: true}).click();
  await page.getByRole('textbox', {name: /^其他要求/u}).fill('简短；保留全部已知瑕疵');
  await page.getByRole('button', {name: '保存并使用', exact: true}).click();
  await page.getByRole('combobox', {name: '文案风格：我的风格', exact: true}).waitFor();
  await generate();
  await page.getByRole('button', {name: '采用并保存', exact: true}).click();
  await page.getByRole('heading', {name: '售卖文案 · 已保存', exact: true}).waitFor();
  assert.match((await state()).records.find(r => r.id === before.id).listingDraft.description, /简短/u);
  await closeDrawer();
  // 实物参考照片场景：仅文字模型被阻止；选择视觉模型后一个按钮串联两次推理。
  await page.goto(base + '/#overseas');
  const title = 'Lift Your Skinny Fists Like Antennas to Heaven';
  const photoBefore = (await state()).records.find(r => r.title === title);
  assert.equal(photoBefore.photoCount, 4);
  await openFrom(page, title);
  const photoGenerate = page.getByRole('button', {name: /^(AI 生成上架资料|重新生成)$/u});
  assert.equal(await photoGenerate.isDisabled(), true);
  await page.getByText('当前模型仅支持文字；请在设置中选择支持图片的模型。', {exact: true}).waitFor();
  await closeDrawer();
  await post('listing/provider', {provider: 'deepseek', model: 'acceptance-vision', effort: 'high'});
  await openFrom(page, title);
  await generate();
  await page.getByRole('heading', {name: '售卖文案 · 已保存', exact: true}).waitFor();
  assert.match(await page.locator('.listing-copy-preview').innerText(), /固定模型响应/u);
  assert.equal((await state()).records.find(r => r.id === photoBefore.id).listed, photoBefore.listed);
  await page.getByRole('button', {name: '复制照片 1', exact: true}).click();
  await page.getByText('图片已复制，可到支持图片粘贴的位置粘贴', {exact: true}).waitFor();
  const copiedImage = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read())[0];
    const blob = await item.getType('image/png'); const bitmap = await createImageBitmap(blob);
    const value = {width: bitmap.width, height: bitmap.height}; bitmap.close(); return value;
  });
  const sourceImage = await page.locator('.listing-photo-tile img').first().evaluate(img => ({width: img.naturalWidth, height: img.naturalHeight}));
  assert.deepEqual(copiedImage, sourceImage, '复制保留原图尺寸，不复制缩略图');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: '保存图片', exact: true}).click();
  await (await download).saveAs(join(output, 'listing-photos.zip'));
  await page.screenshot({path: join(output, 'listing-desktop.png')});
  const phoneContext = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  await phoneContext.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {value: () => true});
    Object.defineProperty(navigator, 'share', {value: data => {
      window.__sharedPhotos = {names: data.files.map(file => file.name), active: navigator.userActivation.isActive};
      return Promise.resolve();
    }});
  });
  const phone = await phoneContext.newPage();
  phone.on('pageerror', e => errors.push(e.message));
  phone.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await phone.goto(base + '/#overseas'); await openFrom(phone, title);
  await phone.getByRole('button', {name: '保存图片', exact: true}).waitFor();
  await phone.waitForFunction(() => !document.querySelector('.listing-footer .photo-download').disabled);
  await phone.waitForTimeout(350);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const copyPosition = await phone.getByRole('button', {name: '复制文案', exact: true}).boundingBox();
  assert.ok(copyPosition.y + copyPosition.height <= 844, '复制按钮一直在首屏底部');
  const textPosition = await phone.locator('.listing-copy-preview').boundingBox();
  const photoPosition = await phone.locator('.listing-photos').boundingBox();
  assert.ok(textPosition.y < photoPosition.y, '文案先于图片与设置');
  await phone.screenshot({path: join(output, 'listing-mobile.png')});
  await phone.getByRole('button', {name: '保存图片', exact: true}).click();
  const shared = await phone.evaluate(() => window.__sharedPhotos);
  assert.equal(shared.names.length, 4); assert.equal(shared.active, true, '系统分享在用户手势内调用');
  await phoneContext.close();
  await page.getByText('生成设置', {exact: true}).click();
  await page.getByRole('textbox', {name: '本次补充', exact: true}).fill('样本冲突');
  await generate();
  await page.getByRole('button', {name: '版本有冲突 · 查看核对依据', exact: true}).click();
  await page.getByText('验收：版本标识冲突，争议版本已省略', {exact: true}).waitFor();
  await page.getByRole('button', {name: '保留原稿', exact: true}).click();
  // 第二标签真实保存；旧抽屉 revision 不能覆盖。
  await page.getByRole('button', {name: '编辑', exact: true}).click();
  const other = await context.newPage();
  await other.goto(base + '/#overseas'); await openFrom(other, title);
  await other.getByRole('button', {name: '编辑', exact: true}).click();
  await other.getByRole('textbox', {name: '售卖正文', exact: true}).fill('另一标签保存的正文');
  await other.getByRole('button', {name: '保存草稿', exact: true}).click();
  await other.getByRole('heading', {name: '管理', exact: true}).waitFor();
  await page.bringToFront();
  if (await page.getByRole('button', {name: '保存草稿', exact: true}).isEnabled()) {
    const response = page.waitForResponse(r => r.url().endsWith('/api/listing/draft'));
    await page.getByRole('button', {name: '保存草稿', exact: true}).click();
    assert.equal((await response).status(), 400);
  }
  assert.equal((await state()).records.find(r => r.id === photoBefore.id).listingDraft.description, '另一标签保存的正文');
  assert.deepEqual(errors.filter(e => !e.includes('400 (Bad Request)')), []);
  console.log(JSON.stringify({passed: true, screenshots: output, liveModel: false}));
} catch (error) {
  await page.screenshot({path: join(output, 'listing-failure.png')});
  console.error('失败页面：', page.url(), await page.locator('.error').allTextContents());
  throw error;
} finally {await browser.close();}
