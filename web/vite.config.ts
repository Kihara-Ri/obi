import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// 构建产物写入仓库根的 static/。文件名保持稳定（不加哈希）：服务端对所有响应
// 下发 Cache-Control: no-store，哈希毫无收益，稳定名便于部署打包与测试断言。
// publicDir 关闭——图标/manifest/sw/vendor 等静态资源由 static/ 手工维护，
// 构建只产出 index.html 与 assets/。
export default defineConfig({
  plugins: [react()],
  server: {fs: {allow: ['..']}},   // 更新说明直接 import 仓库根的 CHANGELOG.md
  build: {
    outDir: '../static',
    emptyOutDir: false,
    assetsDir: 'assets',
    modulePreload: {polyfill: false},
    // 页面拆成多个 chunk（core/lazy-page.ts），样式仍合成一个 index.css：
    // 组件自带的样式若随 chunk 拆出、按需插入，层叠顺序会和现在不同
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        // cssCodeSplit 关闭时合并样式默认叫 style.css；沿用原来的 index.css，index.html 与缓存口径不变
        assetFileNames: info => info.names?.[0] === 'style.css' ? 'assets/index.css' : 'assets/[name][extname]',
      },
    },
  },
});
