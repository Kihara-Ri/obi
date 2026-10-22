// 组装「本机模式」静态站点 → 仓库根的 dist-local/，可直接丢到任意静态托管（Cloudflare Pages / Netlify / GitHub Pages 根域名…）。
// 用法：npm --prefix web run build:local（先跑 vite build，再本脚本）。
// 站点 = static/ 的构建产物 + Pyodide 运行环境 + Python 后端源码 + 本机版 Service Worker + 预缓存清单。
// 服务器部署不受影响：这里的产物不进 static/，也不进 Docker 镜像。决策见 docs/DECISIONS.md D-019。
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'dist-local');
const pyodideDir = join(root, 'web', 'node_modules', 'pyodide');
const lock = JSON.parse(readFileSync(join(pyodideDir, 'pyodide-lock.json'), 'utf8'));
const version = JSON.parse(readFileSync(join(pyodideDir, 'package.json'), 'utf8')).version;

if (!existsSync(join(root, 'static', 'index.html'))) throw new Error('先执行 vite build（static/index.html 不存在）');
rmSync(out, {recursive: true, force: true});
cpSync(join(root, 'static'), out, {recursive: true, filter: src => !src.endsWith('/static/sw.js') && !src.endsWith('/.DS_Store')});
cpSync(join(root, 'static', 'local', 'sw-local.js'), join(out, 'sw.js'));

// 让前端知道自己跑在静态站点上（core/backend.ts 读这个标记）
const index = join(out, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', '<head><meta name="obi-local" content="1">'));

// Pyodide 运行环境 + sqlite3 扩展包（官方分发里单独成包，缺失时从官方 CDN 取并校验 sha256）
const runtime = join(out, 'local', 'pyodide');
mkdirSync(runtime, {recursive: true});
for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) cpSync(join(pyodideDir, f), join(runtime, f));
const wheel = lock.packages.sqlite3;
const wheelPath = join(pyodideDir, wheel.file_name);
if (!existsSync(wheelPath)) {
  const r = await fetch(`https://cdn.jsdelivr.net/pyodide/v${version}/full/${wheel.file_name}`);
  if (!r.ok) throw new Error('下载 sqlite3 扩展包失败：' + r.status);
  writeFileSync(wheelPath, Buffer.from(await r.arrayBuffer()));
}
if (createHash('sha256').update(readFileSync(wheelPath)).digest('hex') !== wheel.sha256) throw new Error('sqlite3 扩展包校验失败');
cpSync(wheelPath, join(runtime, wheel.file_name));

// Python 后端源码：与服务器镜像同一份业务代码（根目录模块 + server/ + vendor/album_data/），不含入口 app.py 与测试
const sources = {};
const take = (dir, deep) => {
  for (const e of readdirSync(join(root, dir), {withFileTypes: true})) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) { if (deep && e.name !== '__pycache__') take(rel, deep); }
    else if (/\.(py|json)$/.test(e.name) && rel !== 'app.py') sources[rel] = readFileSync(join(root, rel), 'utf8');
  }
};
take('.', false); take('server', true); take('vendor/album_data', true);
writeFileSync(join(out, 'local', 'app.json'), JSON.stringify(sources));

// 预缓存清单：站点所有文件；version 由内容决定，任何文件变化都会触发 Service Worker 更新
const files = [];
const hash = createHash('sha256');
const walk = dir => {
  for (const e of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files.push('/' + relative(out, p).split('\\').join('/')); hash.update(files.at(-1)).update(readFileSync(p)); }
  }
};
walk(out);
const listed = ['/', ...files.filter(f => f !== '/sw.js')];
writeFileSync(join(out, 'local', 'precache.json'), JSON.stringify({version: hash.digest('hex').slice(0, 16), files: listed}));
const mb = files.reduce((n, f) => n + statSync(join(out, f)).size, 0) / 1048576;
console.log(`dist-local 已生成：${files.length} 个文件，${mb.toFixed(1)} MB，Python 源码 ${Object.keys(sources).length} 个`);
