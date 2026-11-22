// 介绍站守卫（npm --prefix site run check，构建之后跑）：
// 1. 产物 HTML 不得含内联 <script> / <style> / style= 属性（CSP 红线，见 AGENTS.md）；
// 2. src 下 .astro 的 <style> 与 .css 不得写字面量颜色（颜色只走 token，D-002 / D-044）。
//    .ai-kit 的设计检查不认 .astro 扩展名，所以这里补上。tokens.css 与 public/covers 的作品图除外。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const walk = (dir, ext, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
};

let bad = 0;
const fail = (file, why) => { bad++; console.error(`✗ ${file}: ${why}`); };

let html = [];
try { html = walk(here('../dist/'), ['.html']); } catch { /* 下面统一报错 */ }
if (!html.length) { console.error('✗ 没有找到构建产物，先运行 npm --prefix site run build'); process.exit(1); }
for (const file of html) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(m[1]) || m[2].trim()) fail(file, '内联 <script>');
  }
  if (/<style\b/.test(text)) fail(file, '内联 <style>');
  if (/\sstyle="/.test(text)) fail(file, 'style= 属性');
}

const color = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/;
for (const file of walk(here('../src/'), ['.astro', '.css'])) {
  if (file.endsWith('tokens.css')) continue;
  const text = readFileSync(file, 'utf8');
  const css = file.endsWith('.astro') ? [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') : text;
  css.split('\n').forEach((line, i) => { if (color.test(line)) fail(`${file}:${i + 1}`, `字面量颜色：${line.trim()}`); });
}

if (bad) process.exit(1);
console.log(`✓ ${html.length} 个页面无内联脚本与样式，源码无字面量颜色`);
