/**
 * Album Engine plugin lifecycle acceptance over the fixed offline samples.
 * Unlike showcase-acceptance.mjs this script drives one mutable probe record
 * through create/edit/trash, so run it against a OBI_DEV_HOME instance and
 * `preview_samples.py restore` afterwards to return the dev directory to the
 * canonical seed. Server restart and backup/restore are orchestrated outside;
 * each stage re-reads state and fails fast on preconditions.
 *
 * Stages:
 *   full-ui               uninstall (if installed) → uninstalled browsing/CRUD →
 *                         double-click install (one revision) → 3D view + non-entity stays 2D
 *   uninstall-while-viewing  page A renders 3D, page B uninstalls; A must dispose
 *                         the engine canvas without further plugin requests
 *   after-restart         plugin state persisted, gallery + focus are 2D-only
 *   reinstall-view        install (if needed) → same pinned GLB renders again
 */
export async function accept(page, {baseURL, expectations, screenshotDir, stage = 'full-ui'} = {}) {
  const check = (condition, message) => {if (!condition) throw new Error(message);};
  check(baseURL, 'baseURL is required');
  check(expectations?.galleryCount === 16 && expectations?.models?.length === 3,
    'Pass the verified offline bundle check JSON (16 gallery covers, 3 reference models)');
  const origin = new URL(baseURL).origin;
  const errors = [], failures = [], pluginRequests = [];
  let uninstallMarkedAt = 0, pluginRequestsAfterUninstall = [];
  const onError = error => errors.push(String(error));
  const onConsole = message => {if (message.type() === 'error') errors.push(message.text());};
  const onFailure = request => {if (!request.failure()?.errorText?.includes('ERR_ABORTED')) failures.push(request.url());};
  const onResponse = response => {if (response.url().startsWith(origin) && response.status() >= 400)
    failures.push(response.status() + ' ' + response.url());};
  const onRequest = request => {
    const url = request.url();
    if (!url.includes('/api/plugins/album-engine/assets/')) return;
    pluginRequests.push(url);
    if (uninstallMarkedAt && Date.now() >= uninstallMarkedAt) pluginRequestsAfterUninstall.push(url);
  };
  page.on('pageerror', onError); page.on('console', onConsole);
  page.on('requestfailed', onFailure); page.on('response', onResponse); page.on('request', onRequest);
  // Pin a fully rendered gallery layout on every navigation; the isometric wall
  // only mounts covers near the viewport. Original preferences are restored in finally.
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('obi-acceptance-preferences'))
        sessionStorage.setItem('obi-acceptance-preferences',
          JSON.stringify({value: localStorage.getItem('album-gallery-v1')}));
      localStorage.setItem('album-gallery-v1', JSON.stringify({mode: 'tiles', density: 'medium',
        showTitles: false, sort: 'recent', currentId: null, scope: {kind: 'all'}, roamingPace: 'normal'}));
    } catch { /* Blank initial page has no origin yet. */ }
  });
  const results = [];
  // Park the page on the app origin first: stages may probe the API before
  // navigating, and about:blank cannot issue relative or cross-origin fetches.
  await page.goto(baseURL + '/', {waitUntil: 'domcontentloaded'});
  const settle = () => page.waitForTimeout(800);
  const pluginStatus = () => page.evaluate(async url =>
    await (await fetch(url)).json(), origin + '/api/plugins/album-engine');
  // 设置页按分段标签分类，引擎区块在「高级」标签里
  const openAdvanced = target => target.getByRole('group', {name: '设置分类'}).getByRole('button', {name: '高级'}).click();
  const settingsStatus = page.locator('section[aria-label="Album Engine 插件"] p[role="status"]');
  const openSettings = async () => {
    await page.goto(baseURL + '/#settings', {waitUntil: 'networkidle'});
    await openAdvanced(page);
    await page.locator('section[aria-label="Album Engine 插件"]').waitFor();
  };
  const driveUninstall = async () => {
    await openSettings();
    const before = await pluginStatus();
    check(before.installed, 'uninstall stage requires an installed engine');
    uninstallMarkedAt = Date.now(); // From the mutation click on, no plugin asset request is legitimate.
    await page.locator('section[aria-label="Album Engine 插件"] button.quiet').click();
    await page.locator('section[aria-label="Album Engine 插件"] p[role="status"]')
      .filter({hasText: '未安装'}).waitFor({timeout: 20000});
    return before;
  };
  const driveInstall = async () => {
    await openSettings();
    const before = await pluginStatus();
    check(!before.installed, 'install stage requires an uninstalled engine');
    await page.locator('section[aria-label="Album Engine 插件"] button.primary').click();
    await page.locator('section[aria-label="Album Engine 插件"] p[role="status"]')
      .filter({hasText: new RegExp('已安装 ' + (before.availableVersion ?? ''))}).waitFor({timeout: 30000});
    const after = await pluginStatus();
    check(after.installed && after.entryUrl, 'install must expose the browser entry');
    return {before, after};
  };
  const prepareGallery = async () => {
    await page.setViewportSize({width: 1280, height: 900});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.goto(baseURL + '/#gallery', {waitUntil: 'networkidle'});
    const covers = page.locator('[data-gallery-record-id]');
    await covers.first().waitFor({timeout: 20000});
    const total = await covers.count();
    check(total === expectations.galleryCount,
      'Expected ' + expectations.galleryCount + ' collected covers, got ' + total
        + ' (interrupted acceptance probes leave trashed records — restore the fixed dev dir)');
    for (let index = 0; index < total; index++) {
      const cover = covers.nth(index);
      await cover.scrollIntoViewIfNeeded();
      const image = cover.locator('img');
      if (await image.count()) await image.evaluate(node => node.decode());
    }
    const painted = await covers.evaluateAll(nodes => nodes.map(node => {
      const image = node.querySelector('img');
      return {id: node.dataset.galleryRecordId, hasImage: !!image,
        width: image?.naturalWidth ?? 0, placeholder: !!node.querySelector('.cover-fallback,.gallery-art-message')};
    }));
    check(painted.every(cover => cover.hasImage && cover.width > 100 && !cover.placeholder),
      'Every gallery cover must decode a real image, no placeholders: '
        + JSON.stringify(painted.filter(cover => !cover.hasImage || cover.width <= 100 || cover.placeholder)));
    return covers.count();
  };
  const openFocus = async recordId => {
    if (await page.locator('[data-gallery-record-id]').count() === 0) {
      // The install/uninstall steps leave the page on settings; come back to the gallery.
      await page.goto(baseURL + '/#gallery', {waitUntil: 'networkidle'});
      await page.locator('[data-gallery-record-id]').first().waitFor({timeout: 20000});
    }
    const cover = page.locator(`[data-gallery-record-id="${recordId}"]`).first();
    await cover.scrollIntoViewIfNeeded();
    await cover.click();
    await page.locator('#gallery-focus[open]').waitFor();
    await page.locator('#gallery-focus-title').waitFor();
    await settle();
  };
  const closeFocus = async () => {
    await page.keyboard.press('Escape');
    await page.locator('#gallery-focus').waitFor({state: 'detached'});
    await settle();
  };
  const to3D = async model => {
    await openFocus(model.recordId);
    check(await page.locator('#gallery-focus .album-webgl-canvas').count() === 0, 'Opening must start in 2D');
    // The plugin runtime and twins state load asynchronously after the fresh page load.
    await page.locator('#gallery-focus .gallery-renderer-switch').waitFor({timeout: 20000});
    await page.locator('#gallery-focus .gallery-renderer-switch').getByRole('button', {name: '3D', exact: true}).click();
    const scene = page.locator('#gallery-focus .album-model-scene[aria-busy="false"][data-renderer="webgl"]');
    await scene.waitFor({timeout: 45000});
    await settle();
    const asset = await scene.getAttribute('data-model-asset');
    check(asset?.startsWith('/api/twin-model-assets/') && asset.endsWith('.glb'),
      'Published entities must load their pinned GLB, got: ' + asset);
    check(await page.locator('#gallery-focus .album-webgl-canvas').count() >= 1, '3D needs a WebGL canvas');
    return asset;
  };
  try {
    if (stage === 'full-ui') {
      // While installed the app may prefetch the plugin entry; every assertion
      // about "no plugin traffic" happens after the uninstall mark below.
      const model = expectations.models[1]; // Lift Your Skinny Fists: gatefold 2CD
      const uninstalledRevision = (await driveUninstall()).revision;
      const covers = await prepareGallery();
      check(covers === expectations.galleryCount, 'Expected ' + expectations.galleryCount + ' covers, got ' + covers);
      check(pluginRequestsAfterUninstall.length === 0,
        'Uninstalled client must not request plugin assets: ' + pluginRequestsAfterUninstall.join(', '));
      await openFocus(model.recordId);
      check(await page.locator('#gallery-focus .gallery-renderer-switch').count() === 0,
        'Without the engine the lightbox must stay plain 2D');
      check(await page.locator('#gallery-focus .album-webgl-canvas').count() === 0, 'No WebGL without the engine');
      await closeFocus();
      // Core ledger writes must work while the engine is absent.
      const probe = await page.evaluate(async () => {
        const post = (path, body) => fetch('/api/' + path, {method: 'POST',
          headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());
        const readState = () => fetch('/api/state').then(r => r.json());
        // A previously interrupted acceptance may have left probe records behind.
        const stale = (await readState()).records
          .filter(r => r.title === '引擎验收临时' && r.status !== 'trash').map(r => r.id);
        if (stale.length) await post('bulk', {ids: stale, action: 'delete'});
        const created = await post('records', {title: '引擎验收临时', artist: '验收'});
        const id = created?.id ?? created?.ids?.[0];
        if (!id) throw new Error('create returned no id: ' + JSON.stringify(created));
        let record = (await readState()).records.find(r => r.id === id);
        await post('records', {id, revision: record.revision, note: '插件生命周期验收', price: '11'});
        const removed = await post('bulk', {ids: [id], action: 'delete'});
        record = (await readState()).records.find(r => r.id === id);
        return {id, bulkCount: removed?.count, status: record?.status, note: record?.note};
      });
      check(probe.status === 'trash' && probe.bulkCount === 1 && probe.note === '插件生命周期验收',
        'Create/edit/trash must succeed without the engine: ' + JSON.stringify(probe));
      results.push({check: 'uninstalled browsing + CRUD', covers, probe: probe.id});
      // Rapid double click must still converge to one installation.
      await openSettings();
      const beforeInstall = await pluginStatus();
      check(beforeInstall.revision === uninstalledRevision + 1, 'Uninstall must advance the revision exactly once');
      const installButton = page.locator('section[aria-label="Album Engine 插件"] button.primary');
      // Two clicks in one task model a real rapid double click. Playwright's
      // actionability wait would instead queue the second click until the
      // install finished — landing on the re-rendered 卸载 button and
      // uninstalling what the first click installed.
      await installButton.evaluate(button => {button.click(); button.click();});
      await page.locator('section[aria-label="Album Engine 插件"] p[role="status"]')
        .filter({hasText: '已安装'}).waitFor({timeout: 30000});
      const afterInstall = await pluginStatus();
      check(afterInstall.revision === beforeInstall.revision + 1,
        'Repeated install clicks must apply exactly one revision: ' + beforeInstall.revision + '→' + afterInstall.revision);
      results.push({check: 'double-click install', revision: [beforeInstall.revision, afterInstall.revision]});
      const asset = await to3D(model);
      check(pluginRequests.some(url => url.includes('/browser/plugin.js')),
        'The plugin browser entry must be loaded from the installed assets');
      if (screenshotDir) await page.screenshot({path: screenshotDir + '/engine-installed-3d.png'});
      await closeFocus();
      // A record without a published entity must stay 2D even with the engine present.
      const plain = await page.evaluate(async modelIds => {
        const state = await (await fetch('/api/state')).json();
        const plain = state.records.find(r => !modelIds.includes(r.id)
          && ['domestic', 'overseas', 'transit'].includes(r.status) && r.cover);
        return plain ? plain.id : null;
      }, expectations.models.map(m => m.recordId));
      check(plain, 'Sample library must contain a plain record without an entity');
      await openFocus(plain);
      check(await page.locator('#gallery-focus .gallery-renderer-switch').count() === 0,
        'Records without a published entity must not offer 3D');
      await closeFocus();
      results.push({check: 'installed 3D + non-entity 2D', asset});
    } else if (stage === 'uninstall-while-viewing') {
      await prepareGallery();
      const asset = await to3D(expectations.models[1]);
      const pageB = await page.context().newPage();
      pageB.on('pageerror', onError); pageB.on('console', onConsole);
      await pageB.setViewportSize({width: 1280, height: 900});
      await pageB.goto(baseURL + '/#settings', {waitUntil: 'networkidle'});
      await openAdvanced(pageB);
      await pageB.locator('section[aria-label="Album Engine 插件"]').waitFor();
      uninstallMarkedAt = Date.now(); // pageB prefetch before the click stays legitimate.
      await pageB.locator('section[aria-label="Album Engine 插件"] button.quiet').click();
      await pageB.locator('section[aria-label="Album Engine 插件"] p[role="status"]')
        .filter({hasText: '未安装'}).waitFor({timeout: 20000});
      // The viewing page learns via the storage notify/poll and must dispose GPU work.
      await page.locator('#gallery-focus .album-webgl-canvas').waitFor({state: 'detached', timeout: 15000});
      check(await page.locator('#gallery-focus .album-engine-mount').count() === 0,
        'Engine mounts must be disposed after uninstall');
      check(await page.locator('#gallery-focus .gallery-renderer-switch').count() === 0,
        'The 3D switch must disappear once the engine is gone');
      await pageB.close();
      await settle();
      check(pluginRequestsAfterUninstall.length === 0,
        'No plugin asset request may happen after uninstall: ' + pluginRequestsAfterUninstall.join(', '));
      await page.reload({waitUntil: 'networkidle'});
      await page.locator('[data-gallery-record-id]').first().waitFor({timeout: 20000});
      results.push({check: 'uninstall while viewing', asset, engineRequestsAfterUninstall: 0});
    } else if (stage === 'after-restart') {
      const covers = await prepareGallery();
      const status = await pluginStatus();
      check(!status.installed && !status.error, 'Restart must persist the uninstalled state: ' + JSON.stringify(status));
      const model = expectations.models[0];
      await openFocus(model.recordId);
      check(await page.locator('#gallery-focus .gallery-renderer-switch').count() === 0
        && await page.locator('#gallery-focus .album-webgl-canvas').count() === 0,
        'After restart without the engine the lightbox stays 2D');
      await closeFocus();
      results.push({check: 'after restart', covers, revision: status.revision});
    } else if (stage === 'reinstall-view') {
      let status = await pluginStatus();
      if (!status.installed) {await driveInstall(); status = await pluginStatus();}
      check(status.installed && !status.error, 'Reinstall must yield a healthy engine: ' + JSON.stringify(status));
      await prepareGallery();
      const asset = await to3D(expectations.models[1]);
      if (screenshotDir) await page.screenshot({path: screenshotDir + '/engine-reinstalled-3d.png'});
      await closeFocus();
      results.push({check: 'reinstall view', asset, version: status.version});
    } else {
      throw new Error('Unknown stage: ' + stage);
    }
    check(errors.length === 0, 'Browser errors: ' + errors.join('\n'));
    check(failures.length === 0, 'HTTP/transport failures: ' + failures.join('\n'));
    return {ok: true, stage, sampleVersion: expectations.sampleVersion, results, errors, failures};
  } catch (error) {
    if (screenshotDir) await page.screenshot({path: screenshotDir + '/failure-' + stage + '.png'}).catch(() => {});
    throw error;
  } finally {
    await page.evaluate(() => {
      const preferences = sessionStorage.getItem('obi-acceptance-preferences');
      if (preferences) {
        const {value} = JSON.parse(preferences);
        if (value === null) localStorage.removeItem('album-gallery-v1');
        else localStorage.setItem('album-gallery-v1', value);
        sessionStorage.removeItem('obi-acceptance-preferences');
      }
    }).catch(() => {});
    page.off('pageerror', onError); page.off('console', onConsole);
    page.off('requestfailed', onFailure); page.off('response', onResponse); page.off('request', onRequest);
  }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const {readFile, mkdir} = await import('node:fs/promises');
  const {pathToFileURL} = await import('node:url');
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  const baseURL = args.includes('--url') ? value('--url') : process.env.OBI_PREVIEW_URL;
  const file = args.includes('--expectations') ? value('--expectations') : process.env.OBI_PREVIEW_EXPECTATIONS;
  const stage = args.includes('--stage') ? value('--stage') : 'full-ui';
  if (!baseURL || !file) throw new Error('Usage: node engine-plugin-acceptance.mjs --url http://127.0.0.1:<port> --expectations <check.json> --stage <full-ui|uninstall-while-viewing|after-restart|reinstall-view>');
  const modulePath = process.env.OBI_PLAYWRIGHT_MODULE;
  const {chromium} = await import(modulePath?.startsWith('/') ? pathToFileURL(modulePath).href : modulePath || 'playwright');
  const angle = process.platform === 'darwin' ? 'metal' : 'swiftshader';
  const browser = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=' + angle, '--enable-webgl']});
  try {
    // An explicit context: the uninstall-while-viewing stage opens a second page
    // next to the first (implicit browser.newPage() contexts forbid that).
    const context = await browser.newContext();
    const page = await context.newPage();
    const screenshotDir = process.env.OBI_PREVIEW_SCREENSHOTS;
    if (screenshotDir) await mkdir(screenshotDir, {recursive: true});
    console.log(JSON.stringify(await accept(page, {baseURL, stage,
      expectations: JSON.parse(await readFile(file, 'utf8')), screenshotDir}), null, 2));
  } finally {await browser.close();}
}
