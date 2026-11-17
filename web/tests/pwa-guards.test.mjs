// PWA 与触屏防线的机检：每一条都对应一次真机上出过的问题（docs/PWA与触屏规范.md 逐条写了现象与原因）。
// 只查「防线还在」，不查手感；手感与系统手势只有真机能证明。
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));
const src = join(web, 'src');
const read = path => readFileSync(join(web, path), 'utf8');
// 去掉注释再查：注释里会写「不用 light-dark()」这类反例
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function* files(dir, pattern) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'vendor') yield* files(path, pattern); }
    else if (pattern.test(name)) yield path;
  }
}
const cssFiles = [...files(src, /\.css$/)];

test('viewport：铺满刘海区、禁止系统缩放；theme-color 按深浅各给一份', () => {
  const html = read('index.html');
  const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] || '';
  for (const part of ['width=device-width', 'initial-scale=1', 'maximum-scale=1', 'user-scalable=no', 'viewport-fit=cover'])
    assert.ok(viewport.includes(part), `viewport 缺 ${part}`);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: dark\)"/);
});

test('双指缩放：iOS 忽略 user-scalable=no，靠 touch-action 与 gesturestart 兜住', () => {
  const base = code(read('src/styles/base.css'));
  assert.match(base, /html\{touch-action:pan-x pan-y;overscroll-behavior:none\}/, 'html 需 touch-action:pan-x pan-y 且禁橡皮筋');
  assert.match(base, /body\{overscroll-behavior:none\}/);
  assert.match(code(read('src/main.tsx')), /addEventListener\('gesturestart', e => e\.preventDefault\(\)\)/);
});

test('输入框在手机上不小于 16px（否则 iOS 聚焦时自动放大页面）', () => {
  const base = code(read('src/styles/base.css'));
  assert.match(base, /@media \(max-width:840px\)\{\s*input,select,textarea\{font-size:16px\}/);
  const small = [];
  for (const file of cssFiles) {
    for (const [, sel, body] of code(readFileSync(file, 'utf8')).matchAll(/([^{}]*(?:^|[\s>+~,(])(?:input|textarea|select)(?![\w-])[^{}]*)\{([^{}]*)\}/g)) {
      const size = /font-size:\s*([\d.]+)px/.exec(body)?.[1];
      if (size && Number(size) < 16 && !/checkbox|radio|range|:not\(/.test(sel)) small.push(`${relative(src, file)}: ${sel.trim()} → ${size}px`);
    }
  }
  // 抽屉里的文字框在手机上由 useFloatingFields 接管（点按弹出 FocusInput，原框不聚焦），字号可以小于 16px
  const IN_DRAWER = /#panel|\.rmf-grid|\.cover-url/;
  assert.deepEqual(small.filter(line => !IN_DRAWER.test(line)), []);
});

test('长按：应用内 # 链接不弹 iOS 链接预览（预览里的「打开」会新开页面）', () => {
  assert.match(code(read('src/styles/base.css')), /a\[href\^="#"\]\{-webkit-touch-callout:none\}/);
});

test('主题：不用 light-dark()（旧 WebView 整条声明作废，永远深色）', () => {
  const hits = cssFiles.filter(file => /light-dark\(/.test(code(readFileSync(file, 'utf8')))).map(file => relative(src, file));
  assert.deepEqual(hits, []);
});

test('视口高度：手机上可见的 100vh 后面必须跟 svh / dvh（iOS 的 100vh 比可见区高）', () => {
  const DESKTOP_ONLY = new Set(['.sidebar']);   // 手机断点内 display:none
  const bad = [];
  for (const file of cssFiles) {
    for (const [, sel, body] of code(readFileSync(file, 'utf8')).matchAll(/([^{}]+)\{([^{}]*100vh[^{}]*)\}/g)) {
      if (DESKTOP_ONLY.has(sel.trim())) continue;
      if (!/\d+[sd]vh/.test(body)) bad.push(`${relative(src, file)}: ${sel.trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('左缘返回：起手即拦系统手势（touchstart / touchmove 非 passive）', () => {
  const edge = code(read('src/core/edge-swipe.ts'));
  assert.match(edge, /addEventListener\('touchstart', onStart, \{passive: false/);
  assert.match(edge, /addEventListener\('touchmove', onMove, \{passive: false/);
  assert.match(edge, /addEventListener\('touchcancel'/, '系统抢走手势时要能回弹');
});

test('切页历史：只有 core/nav.ts 能改 location.hash（手机切页用 replace，免得右划退回上一页）', () => {
  const bad = [];
  for (const file of files(src, /\.tsx?$/)) {
    if (file.endsWith(join('core', 'nav.ts'))) continue;
    if (/location\.hash\s*=[^=]/.test(code(readFileSync(file, 'utf8')))) bad.push(relative(src, file));
  }
  assert.deepEqual(bad, []);
});

test('悬停效果只给鼠标：触屏点完 :hover 会粘住，抬起 / 位移类悬停须放进 (hover:hover)', () => {
  const bad = [];
  for (const file of cssFiles) {
    const text = code(readFileSync(file, 'utf8'));
    // 去掉 (hover:hover) 媒体块后，剩下的 :hover 规则不许带 transform / translate
    // 在 (hover:none) 里被复位的选择器不算
    const reset = new Set([...text.matchAll(/@media[^{]*\(hover:\s*none\)[^{]*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
      .flatMap(([, inner]) => [...inner.matchAll(/([^{}]+)\{/g)].flatMap(([, sel]) => sel.split(',').map(x => x.trim()))));
    const outside = text.replace(/@media[^{]*\(hover:\s*hover\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const [, sel, body] of outside.matchAll(/([^{}]*:hover[^{}]*)\{([^{}]*)\}/g))
      if (/(?:^|;)\s*(?:transform|translate)\s*:/.test(body) && !/:active/.test(sel) && !sel.split(',').every(x => reset.has(x.trim()))) bad.push(`${relative(src, file)}: ${sel.trim()}`);
  }
  assert.deepEqual(bad, []);
});
