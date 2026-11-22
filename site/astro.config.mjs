// Obi 介绍站配置（见 docs/DECISIONS.md D-044）。
// base 由 Pages 工作流经 SITE_BASE 传入：项目页是 /obi/，绑了自定义域名就是 /。
// CSP 不允许内联：样式一律外链、脚本不内联（assetsInlineLimit 0），由 tests/csp.test.mjs 检查产物。
import { defineConfig } from 'astro/config';

export default defineConfig({
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'never', assets: 'assets' },
  vite: {
    build: { assetsInlineLimit: 0 },
    server: { fs: { allow: ['..'] } },
  },
});
