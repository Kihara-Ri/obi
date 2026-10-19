/**
 * Real sample acceptance. The exported function is intentionally self-contained:
 * tools may inject accept.toString() into an existing Playwright page without
 * importing Node modules. It reads samples; it never mutates ledger records.
 */
export async function accept(page, {baseURL, expectations, screenshotDir, saveShot} = {}) {
  const check = (condition, message) => {if (!condition) throw new Error(message);};
  check(baseURL, 'baseURL is required');
  check(expectations?.galleryCount === 16 && expectations?.models?.length === 3,
    'Pass the verified offline bundle check JSON (16 gallery covers, 3 reference models)');
  const origin = new URL(baseURL).origin;
  const errors = [], failures = [], responses = new Map(), modelRequests = [];
  const onError = error => errors.push(String(error));
  const onConsole = message => {if (message.type() === 'error') errors.push(message.text());};
  const onFailure = request => {
    // Navigation and intentionally disposed renderer requests may be cancelled;
    // an actual transport failure is never swallowed.
    if (!request.failure()?.errorText?.includes('ERR_ABORTED')) failures.push(request.url());
  };
  const onResponse = response => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      failures.push(response.status() + ' ' + response.url());
    responses.set(response.url(), response);
  };
  const onRequest = request => {if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url());};
  page.on('pageerror', onError); page.on('console', onConsole);
  page.on('requestfailed', onFailure); page.on('response', onResponse); page.on('request', onRequest);
  const results = [];
  const settle = () => page.waitForTimeout(800); // 260 ms focus zoom, 690 ms card flip.
  // The engine's open/rotate/disc motion is a JS physics loop, not CSS: it keeps
  // requesting frames regardless of preferences, and under CI's software GL each
  // pending frame costs seconds, so page.screenshot starved behind the queue
  // (30s timeout). Park requestAnimationFrame around the capture — the already
  // scheduled frame lands, the loop pauses, and screenshots are documentation
  // only (every assertion is attribute-based). Restoring rAF resumes the loop.
  const shot = async path => {
    const park = on => page.evaluate(flag => {
      if (flag) {
        if (window.__acceptanceRaf) return;
        window.__acceptanceRaf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = () => 0;
      } else if (window.__acceptanceRaf) {
        window.requestAnimationFrame = window.__acceptanceRaf;
        delete window.__acceptanceRaf;
      }
    }, on).catch(() => {});
    await park(true);
    try {
      if (typeof saveShot === 'function') {
        // Playwright's screenshot pipeline deadlocks on the Linux software-GL
        // runner — even a viewport-sized clip times out at 30s — while a raw
        // CDP capture of the same parked surface returns in ~0.2s with the
        // same viewport pixels. The Node caller persists the base64 payload.
        const cdp = await page.context().newCDPSession(page);
        try {
          const {data} = await cdp.send('Page.captureScreenshot', {format: 'png'});
          await saveShot(path, data);
        } finally {await cdp.detach();}
      } else await page.screenshot({path});
    } finally {await park(false);}
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    await page.locator('#gallery-focus').waitFor({state: 'detached'});
    await settle();
  };
  const open = async model => {
    const cover = page.locator(`[data-gallery-record-id="${model.recordId}"]`).first();
    await cover.scrollIntoViewIfNeeded();
    // Playwright can scroll a few pixels between an actionability trial and
    // pointerdown. Capture painted thumbnail pixels at the actual click,
    // precisely when the app calculates the shared-element zoom origin.
    await cover.click({trial: true});
    await cover.locator('img').evaluate(image => {
      const button = image.closest('[data-gallery-record-id]');
      button.addEventListener('pointerdown', () => {
        const box = image.getBoundingClientRect();
        const aspect = image.naturalWidth / image.naturalHeight;
        const width = Math.min(box.width, box.height * aspect);
        const height = width / aspect;
        button.dataset.acceptanceZoomOrigin = JSON.stringify({
          x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height,
        });
      }, {capture: true, once: true});
    });
    await cover.click();
    const thumbnail = await cover.evaluate(node => JSON.parse(node.dataset.acceptanceZoomOrigin ?? 'null'));
    await page.locator('#gallery-focus[open]').waitFor();
    const zoomFrames = await page.locator('.gallery-focus-transition-image').evaluate(node =>
      node.getAnimations().flatMap(animation => animation.effect.getKeyframes()));
    if (zoomFrames.length && thumbnail) {
      const from = zoomFrames[0], to = zoomFrames[zoomFrames.length - 1];
      const aspect = await cover.locator('img').evaluate(image => image.naturalWidth / image.naturalHeight);
      check(Math.abs(Number.parseFloat(from.width) / Number.parseFloat(from.height) - aspect) < .02
        && Math.abs(Number.parseFloat(to.width) / Number.parseFloat(to.height) - aspect) < .02,
        'Shared cover zoom must preserve real image aspect at both endpoints');
      check(Math.abs(Number.parseFloat(from.left) - thumbnail.x) < 2
        && Math.abs(Number.parseFloat(from.top) - thumbnail.y) < 2
        && Math.abs(Number.parseFloat(from.width) - thumbnail.width) < 2
        && Math.abs(Number.parseFloat(from.height) - thumbnail.height) < 2,
        'Zoom must start at actual thumbnail pixels: ' + JSON.stringify({thumbnail, from, to}));
    }
    await settle();
    check(await page.locator('#gallery-focus-title').textContent() === model.title, 'Wrong focused album: ' + model.title);
    check(await page.locator('#gallery-focus .album-webgl-canvas').count() === 0, 'Opening must start in 2D');
    check(await page.locator('#gallery-focus .gallery-renderer-switch button.on').textContent() === '2D', '2D must be selected');
  };
  const to3D = async () => {
    await page.locator('#gallery-focus .gallery-renderer-switch').getByRole('button', {name: '3D', exact: true}).click();
    await page.locator('#gallery-focus .album-model-scene[aria-busy="false"][data-renderer="webgl"]').waitFor({timeout: 45000});
    await settle();
  };
  const viewport = async () => {
    const bounds = await page.locator('#gallery-focus .album-webgl-canvas').boundingBox();
    const size = page.viewportSize();
    check(bounds && Math.abs(bounds.x) <= 1 && Math.abs(bounds.y) <= 1
      && Math.abs(bounds.width - size.width) <= 1 && Math.abs(bounds.height - size.height) <= 1,
    '3D canvas must fill the viewport without title/container clipping');
    check(await page.locator('#gallery-focus-title').evaluate(node => getComputedStyle(node).pointerEvents) === 'none',
      '3D title must not block model gestures');
  };
  try {
    await page.setViewportSize({width: 1280, height: 900});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.evaluate(() => {
      try {sessionStorage.removeItem('diedu-acceptance-finished');} catch { /* New blank page has no origin yet. */ }
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('diedu-acceptance-finished') === 'yes' || window.__showcaseOriginalContext) return;
      if (!sessionStorage.getItem('diedu-acceptance-preferences'))
        sessionStorage.setItem('diedu-acceptance-preferences', JSON.stringify({value: localStorage.getItem('album-gallery-v1')}));
      localStorage.setItem('album-gallery-v1', JSON.stringify({mode: 'tiles', density: 'medium',
        showTitles: false, sort: 'recent', currentId: null, scope: {kind: 'all'}, roamingSpeeds: {}}));
      window.__showcaseContexts = 0;
      window.__showcaseLosses = 0;
      const tracked = new WeakSet();
      const getContext = HTMLCanvasElement.prototype.getContext;
      window.__showcaseOriginalContext = getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (String(type).includes('webgl')) {
          window.__showcaseContexts++;
          if (!tracked.has(this)) {
            tracked.add(this);
            this.addEventListener('webglcontextlost', () => window.__showcaseLosses++);
          }
        }
        return getContext.call(this, type, ...args);
      };
    });
    await page.goto(baseURL.replace(/\/$/, '') + '/#gallery', {waitUntil: 'networkidle'});
    // Same-document hash navigation can retain old React records after the
    // fixed sample instance was rebuilt. Always start acceptance from a fresh
    // document, so rendered IDs and API/bundle expectations share one epoch.
    await page.reload({waitUntil: 'networkidle'});
    await page.locator('.gallery-cover-button').first().waitFor();
    const covers = page.locator('.gallery-cover-button');
    check(await covers.count() === expectations.galleryCount, 'Gallery must contain all 16 collected sample copies');
    for (let index = 0; index < await covers.count(); index++) {
      const cover = covers.nth(index); await cover.scrollIntoViewIfNeeded();
      await cover.locator('img').evaluate(image => image.decode());
    }
    const decoded = await covers.evaluateAll(nodes => nodes.map(node => {
      const image = node.querySelector('img');
      return {id: node.dataset.galleryRecordId, src: image?.currentSrc,
        width: image?.naturalWidth, height: image?.naturalHeight, placeholder: !!node.querySelector('.cover-fallback,.gallery-art-message')};
    }));
    check(decoded.every(cover => cover.width > 100 && cover.height > 100 && !cover.placeholder),
      'Every sample must display a decoded real cover, with no placeholder');
    if (expectations.coverAssets) {
      for (const cover of decoded) {
        const expected = expectations.coverAssets.find(item => item.recordId === cover.id);
        check(expected && new URL(expected.url, origin).href === cover.src, 'Unexpected cover source for ' + cover.id);
        if (expected.sha256) {
          const hash = await page.evaluate(async url => {
            const bytes = await (await fetch(url)).arrayBuffer();
            return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
          }, cover.src);
          check(hash === expected.sha256, 'Unexpected cover bytes for ' + cover.id);
        }
      }
    }
    check(modelRequests.length === 0 && await page.evaluate(() => window.__showcaseContexts) === 0,
      'Browsing 2D must not download GLB or create WebGL');
    results.push({check: 'gallery', decodedCovers: decoded.length});

    // Actual card behavior replaces source-string assertions. PBR reflection
    // coefficients belong to rendering, rather than a test of JS spelling.
    const first = expectations.models[0];
    await open(first);
    check(await page.evaluate(() => window.__showcaseContexts) === 0, 'Opening 2D must not create WebGL');
    const card = page.locator('#gallery-focus .album-flip-card');
    const face = page.locator('#gallery-focus .album-flip-rotor');
    check(await face.getAttribute('aria-pressed') === 'false', 'Initial front accessibility state');
    const frontBox = await card.boundingBox();
    check(frontBox.width <= 680.5 && frontBox.height <= 680.5, 'Desktop focus card must fit viewport');
    await face.click(); await settle();
    check(await face.getAttribute('aria-pressed') === 'true', 'Flip exposes the reverse accessible state');
    check(await page.locator('.album-flip-back').getAttribute('aria-hidden') === 'false', 'Back face must be accessible');
    check(await page.locator('.album-flip-date-label').textContent() === 'Collected on', 'Collection date label is visible');
    check((await page.locator('.album-flip-handwritten').textContent()).trim().length > 0, 'Collection date or missing-date text is visible');
    // Regression: long release-group names must wrap inside the keepsake,
    // stay centred, and never inherit button white-space: nowrap. This only
    // temporarily edits DOM text in an isolated acceptance browser session.
    const longTitleFit = await page.locator('.album-flip-album-title').evaluate(node => {
      const original = node.textContent;
      const face = node.closest('.album-flip-back');
      const cases = [
        'Lift Your Skinny Fists Like Antennas to Heaven',
        'A Longer Story of the Night We Learned How to Name Every Star in the Sky — Special Collector Edition 2026',
        'THE_SUPER_LONG_UNBROKEN_ALBUM_TITLE_WITH_NO_SPACES_THAT_MUST_NOT_OVERFLOW_EVEN_ON_MOBILE',
      ];
      const snapshots = [];
      for (const text of cases) {
        node.textContent = text;
        const faceBox = face.getBoundingClientRect();
        const titleBox = node.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
        snapshots.push({
          lines: Math.round(titleBox.height / lineHeight),
          leftOverflow: titleBox.left < faceBox.left - 1,
          rightOverflow: titleBox.right > faceBox.right + 1,
          overflow: node.scrollWidth > node.clientWidth + 1,
          centering: Math.abs((titleBox.left + titleBox.right - faceBox.left - faceBox.right) / 2),
        });
      }
      node.textContent = original;
      return snapshots;
    });
    check(longTitleFit.every(item => item.lines >= 2 && !item.leftOverflow
      && !item.rightOverflow && !item.overflow && item.centering <= 2),
    'Long album titles must wrap and remain centered inside the flip card: ' + JSON.stringify(longTitleFit));
    await page.locator('.album-metal-canvas[data-metal-status="rendered"]').waitFor({timeout: 30000});
    check([...responses.keys()].some(url => url.includes('studio_small_05_1k.hdr')), 'Real studio HDR must load');
    check(await page.locator('#gallery-focus .album-like-toggle').count() === 0, 'Gallery cannot edit likes');
    await page.mouse.move(frontBox.x + frontBox.width * .75, frontBox.y + frontBox.height * .25);
    const tilt = await card.evaluate(node => node.style.getPropertyValue('--card-tilt-y'));
    check(tilt && tilt !== '0deg', 'Pointer tilts the whole card');
    check(await card.evaluate(node => getComputedStyle(node.querySelector('.album-flip-back'), '::before').content) === 'none', 'No cursor spotlight pseudo-layer');
    await page.mouse.move(1, 1);
    check(await card.evaluate(node => node.style.getPropertyValue('--card-tilt-y')) === '0deg', 'Pointer leave resets tilt');
    await face.click(); await settle();
    check(await face.getAttribute('aria-pressed') === 'false', 'Reverse flip restores front');
    const beforeMetalClose = await page.evaluate(() => window.__showcaseLosses);
    await close();
    check(await page.evaluate(() => window.__showcaseLosses) > beforeMetalClose, 'Closing must release decorative GPU context');
    check(await page.locator('.album-metal-canvas').count() === 0, 'Closing removes decorative GPU canvas');
    results.push({check: 'card', flip: true, hdr: true, tilt: true, cleanup: true});
    await open(first);
    const next = page.locator('.gallery-focus-next');
    const forward = await next.isEnabled();
    const navigation = forward ? next : page.locator('.gallery-focus-prev');
    check(await navigation.isEnabled(), 'Multiple collected albums must allow navigation');
    {
      await navigation.click();
      await page.waitForFunction(title => document.querySelector('#gallery-focus-title')?.textContent !== title, first.title);
      await settle();
      check(await page.locator('.album-flip-rotor').getAttribute('aria-pressed') === 'false', 'Changing album resets flip');
      check(await page.locator('.album-webgl-canvas').count() === 0, 'Changing album resets to 2D');
      await page.locator(forward ? '.gallery-focus-prev' : '.gallery-focus-next').click();
      await page.waitForFunction(title => document.querySelector('#gallery-focus-title')?.textContent === title, first.title);
      await settle();
    }
    await close();

    for (const model of expectations.models) {
      await open(model); await to3D(); await viewport();
      const scene = page.locator('#gallery-focus .album-model-scene');
      check((await scene.getAttribute('data-model-asset')).endsWith('.glb'), 'Blender GLB must be active: ' + model.title);
      // Every expected front/back/inside/disc/attachment/back source must have
      // been requested by the renderer, then independently decode as an image.
      for (const asset of model.assets) {
        const url = new URL(asset.url, origin).href;
        const response = responses.get(url);
        check(response && response.ok(), 'Renderer did not load ' + (asset.role || asset.url));
        check((await response.headerValue('content-type'))?.startsWith('image/'), 'Texture response must be an image');
        const decodedImage = await page.evaluate(async url => {
          const image = new Image(); image.src = url; await image.decode();
          return {width: image.naturalWidth, height: image.naturalHeight};
        }, url);
        check(decodedImage.width > 100 && decodedImage.height > 100, 'Texture image is incomplete');
        if (asset.sha256) {
          const hash = await page.evaluate(async url => {
            const bytes = await (await fetch(url)).arrayBuffer();
            return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
          }, url);
          check(hash === asset.sha256, 'Unexpected texture bytes for ' + asset.url);
        }
      }
      await scene.focus(); await page.keyboard.press('Enter');
      // Software GL runs the open spring at seconds per frame: the heaviest
      // 2CD case needs ~35s on a Mac and far more on CI, so give the
      // animation a real budget and dump the frozen state if it still fails.
      try {
        await page.waitForFunction(() => Number(document.querySelector('.album-model-scene')?.dataset.renderedOpen) > .98, null, {timeout: 300000});
      } catch (error) {
        console.log('[open-diag]', await page.evaluate(() => JSON.stringify({
          rafPatched: !!window.__acceptanceRaf,
          renderedOpen: document.querySelector('.album-model-scene')?.dataset.renderedOpen ?? null,
          yaw: document.querySelector('.album-model-scene')?.dataset.yaw ?? null,
          busy: document.querySelector('.album-model-scene')?.getAttribute('aria-busy') ?? null,
        })).catch(e => String(e).split('\n')[0]));
        throw error;
      }
      const openYaw = await scene.getAttribute('data-yaw');
      await page.keyboard.press('ArrowRight'); await settle();
      check(await scene.getAttribute('data-yaw') !== openYaw, 'Album keyboard rotation must work');
      if (/Lift Your Skinny Fists/.test(model.title)) {
        await page.keyboard.press('2');
        // Same software-GL budget as the open spring above; dump the frozen state if it still stalls.
        try {
          await page.waitForFunction(() => {
            const node = document.querySelector('.album-model-scene');
            return node?.dataset.disc === '2' && Number(node.dataset.discProgress) > .98;
          }, null, {timeout: 240000});
        } catch (error) {
          console.log('[disc-diag]', await page.evaluate(() => JSON.stringify({
            disc: document.querySelector('.album-model-scene')?.dataset.disc ?? null,
            progress: document.querySelector('.album-model-scene')?.dataset.discProgress ?? null,
            renderedOpen: document.querySelector('.album-model-scene')?.dataset.renderedOpen ?? null,
          })).catch(e => String(e).split('\n')[0]));
          throw error;
        }
        const albumYaw = await scene.getAttribute('data-yaw');
        const discYaw = await scene.getAttribute('data-disc-yaw');
        await page.keyboard.press('ArrowRight'); await settle();
        check(await scene.getAttribute('data-yaw') === albumYaw && await scene.getAttribute('data-disc-yaw') !== discYaw,
          'Extracted CD 2 must rotate independently');
        await page.keyboard.press('2');
        await page.waitForFunction(() => Number(document.querySelector('.album-model-scene')?.dataset.discProgress) < .01, null, {timeout: 240000});
      }
      if (screenshotDir) await shot(screenshotDir + '/' + model.recordId + '-3d.png');
      await close(); await open(model);
      check(await page.locator('.album-webgl-canvas').count() === 0, 'Reopening returns to 2D');
      await close();
      results.push({check: 'model', title: model.title, textures: model.assets.length, reopenedIn2D: true});
    }
    // Read-only response substitution exercises both liked/unliked display
    // without changing the fixed ledger or its favorite records.
    const favoriteResponse = await page.request.get(origin + '/api/album-favorites');
    check(favoriteResponse.ok(), 'Album favorite catalog must load');
    const favoriteCatalog = await favoriteResponse.json();
    const metalColors = [];
    for (const liked of [false, true]) {
      const route = async request => request.fulfill({status: 200, contentType: 'application/json',
        body: JSON.stringify({...favoriteCatalog, favorites: {...favoriteCatalog.favorites, [first.recordId]: liked}})});
      await page.route('**/api/album-favorites', route);
      try {
        await page.reload({waitUntil: 'networkidle'}); await open(first);
        check(await page.locator('.album-flip-card').evaluate(node => node.classList.contains('is-liked')) === liked,
          'Gold must follow album favorite state');
        await page.locator('.album-flip-rotor').click(); await settle();
        await page.locator('.album-metal-canvas[data-metal-status="rendered"]').waitFor();
        metalColors.push(await page.locator('.album-flip-back').evaluate(node => getComputedStyle(node).backgroundImage));
        if (screenshotDir) await shot(screenshotDir + (liked ? '/card-gold.png' : '/card-silver.png'));
        await close();
      } finally {await page.unroute('**/api/album-favorites', route);}
    }
    check(metalColors[0] !== metalColors[1], 'Liked and ordinary cards must have distinct gold/silver surfaces');
    await page.reload({waitUntil: 'networkidle'});
    results.push({check: 'card-material-variants', silver: true, gold: true, ledgerWrites: 0});

    // Device-sized viewport, context loss, explicit retry, and background hit
    // testing replace CSS selector string tests against the real mounted UI.
    await page.setViewportSize({width: 390, height: 844});
    await open(first); await to3D(); await viewport();
    await page.locator('.album-webgl-canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true})));
    await page.locator('.gallery-engine-unavailable').waitFor();
    check(await page.locator('.album-webgl-canvas').count() === 0, 'Context failure must clean up 3D');
    check(await page.locator('.gallery-renderer-switch button.on').textContent() === '2D', 'Context failure returns to 2D');
    await to3D(); await close();
    await page.emulateMedia({reducedMotion: 'reduce'});
    await open(first);
    const reducedCard = page.locator('.album-flip-card');
    const reducedBox = await reducedCard.boundingBox();
    check(reducedBox.x >= 0 && reducedBox.x + reducedBox.width <= 391 && reducedBox.height < 844, 'Mobile card must remain within viewport');
    await page.mouse.move(reducedBox.x + reducedBox.width * .75, reducedBox.y + reducedBox.height * .25);
    check(await reducedCard.evaluate(node => !node.style.getPropertyValue('--card-tilt-y')
      || node.style.getPropertyValue('--card-tilt-y') === '0deg'), 'Reduced motion must suppress pointer tilt');
    check(await reducedCard.evaluate(node => Number.parseFloat(getComputedStyle(node.querySelector('.album-flip-rotor')).transitionDuration)) < .01,
      'Reduced motion must suppress flip transition');
    check(await page.locator('#gallery-focus').evaluate(node => getComputedStyle(node).cursor) === 'default', 'Blank lightbox uses ordinary cursor');
    // Blank space above the image goes through the visual container to shade.
    await page.mouse.click(3, 4);
    await page.locator('#gallery-focus').waitFor({state: 'detached'});
    results.push({check: 'mobile/fallback', fullViewport: true, retry: true, reducedMotion: true, backgroundDismiss: true});
    check(errors.length === 0, 'Browser errors: ' + errors.join('\n'));
    check(failures.length === 0, 'HTTP/transport failures: ' + failures.join('\n'));
    return {ok: true, sampleVersion: expectations.sampleVersion, results, errors, failures};
  } catch (error) {
    if (screenshotDir) await page.screenshot({path: screenshotDir + '/failure.png'}).catch(() => {});
    throw error;
  } finally {
    // Leave an injected tool page usable after acceptance, including reloads.
    await page.evaluate(() => {
      const preferences = sessionStorage.getItem('diedu-acceptance-preferences');
      if (preferences) {
        const {value} = JSON.parse(preferences);
        if (value === null) localStorage.removeItem('album-gallery-v1');
        else localStorage.setItem('album-gallery-v1', value);
        sessionStorage.removeItem('diedu-acceptance-preferences');
      }
      sessionStorage.setItem('diedu-acceptance-finished', 'yes');
      if (window.__showcaseOriginalContext) HTMLCanvasElement.prototype.getContext = window.__showcaseOriginalContext;
    }).catch(() => {});
    page.off('pageerror', onError); page.off('console', onConsole);
    page.off('requestfailed', onFailure); page.off('response', onResponse); page.off('request', onRequest);
  }
}

// Optional CLI. Browser automation environments can instead inject accept above.
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const {readFile, mkdir} = await import('node:fs/promises');
  const {pathToFileURL} = await import('node:url');
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  const baseURL = args.includes('--url') ? value('--url') : process.env.DIEDU_PREVIEW_URL;
  const file = args.includes('--expectations') ? value('--expectations') : process.env.DIEDU_PREVIEW_EXPECTATIONS;
  if (!baseURL || !file) throw new Error('Usage: npm run test:browser -- --url http://127.0.0.1:<port> --expectations <check.json>');
  const modulePath = process.env.DIEDU_PLAYWRIGHT_MODULE;
  const {chromium} = await import(modulePath?.startsWith('/') ? pathToFileURL(modulePath).href : modulePath || 'playwright');
  // Apple's Metal renderer keeps real GL animations running in macOS headless
  // acceptance. SwiftShader can saturate software GPU and stall RAF on this rig.
  const angle = process.platform === 'darwin' ? 'metal' : 'swiftshader';
  const browser = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=' + angle, '--enable-webgl']});
  try {
    const page = await browser.newPage();
    const screenshotDir = process.env.DIEDU_PREVIEW_SCREENSHOTS;
    if (screenshotDir) await mkdir(screenshotDir, {recursive: true});
    const {writeFile} = await import('node:fs/promises');
    const saveShot = (path, base64) => writeFile(path, Buffer.from(base64, 'base64'));
    console.log(JSON.stringify(await accept(page, {baseURL, expectations: JSON.parse(await readFile(file, 'utf8')), screenshotDir, saveShot}), null, 2));
  } finally {await browser.close();}
}
