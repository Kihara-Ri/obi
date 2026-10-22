# 2026-10-21 · 前端按页面拆包；App.tsx 拆成外壳 + 各自的 hook / 组件

- **作者**：Claude
- **范围**：web/vite.config.ts、web/src/core/lazy-page.ts（新）、web/src/App.tsx、web/src/state/useDrawerStack.ts（新）、web/src/state/useShelfView.ts（新）、web/src/hooks/usePageTransition.ts（新）、web/src/hooks/usePwa.ts（新）、web/src/components/AppNav.tsx（新）、web/src/components/REGISTRY.md、web/src/core/modules.ts（注释）、web/src/styles/pagetransition.css（注释）、.ai-kit/legacy.txt、AGENTS.md、docs/KNOWN-ISSUES.md

## 改了什么
- **按页面拆包**：
  - 10 个页面改为 `lazyPage(() => import(...))`，各成一个 chunk；主包 `index.js` 从 648 KB（gzip 225 KB）降到 305 KB（gzip 98 KB）。
  - 页面 chunk 在 `App` 模块加载时就开始下载，与首个 `/api/state` 并行；`pagesReady()` 和状态都到齐才渲染首屏。
  - 之后切页仍是同步渲染，所以切页动画抓快照、量高度的时机与拆包前相同。没有用 `React.lazy` / `Suspense`，因为那样首次进入某页会先渲染一帧空白。
  - 任何 chunk 加载失败都走原有的「暂时无法打开碟渡 · 重新连接」界面。
- **样式仍是一个 `index.css`**：`cssCodeSplit: false`，合并后的文件名映射回 `assets/index.css`，`index.html` 与 `static_files.PUBLIC` 不变。
- **App.tsx（586 → 200 行，移出 legacy.txt）**：
  - 抽屉栈和返回手势移到 `state/useDrawerStack.ts`。
  - 切页动画、`PAGE_RANK`、库存 ↔ 展示幕布移到 `hooks/usePageTransition.ts`。
  - Service Worker、离线横幅、安装入口移到 `hooks/usePwa.ts`。
  - 库存视图偏好移到 `state/useShelfView.ts`。
  - 侧栏、底栏与数量统计移到 `components/AppNav.tsx`（`Sidebar` / `MobileNav` / `navCounts`），已登记到组件注册表。
  - 各段代码原样搬移，effect 的注册顺序不变：抽屉的 popstate 监听仍先于切页快照的 popstate 监听。

## 出现的问题
- **CSS 顺序**：合并单个 CSS 后与拆包前逐条规则比对，只有 `ListingSteps` 的 9 条规则（`.listing-steps*`）位置前移（它现在先被 SaleForm 共享 chunk 引入）。
  - 检查了这 9 条前后位置之间的所有规则，没有一条能命中 `.listing-steps` 元素，因此层叠结果不变。
  - 其余 1597 条规则的顺序与内容完全相同。
- **构建清理**：分包后 chunk 文件名会随模块图变化。原本想加一个构建插件来清空 `static/assets`，后来发现 `prebuild` 的 `scripts/clean.mjs` 已经在做这件事，插件就去掉了。插件还会让 `vite.config.ts` 引用 `node:fs`，而项目没有 `@types/node`，typecheck 会失败。
- **storage.py 没有拆**：按审查时的提议把它拆成 `server/store_*.py` mixin，拆完后 AST 逐函数比对无差异，457 条后端测试全过。但 AGENTS.md「后端」一节明确规定「`storage.py` 保持单文件（跨表事务 + 审计内聚，不拆）」，因此没有合入，等用户决定。
  - 拆分还需要把 `server/__init__.py` 改为按需导入，否则会形成 storage → server → routes → storage 的循环。

## 怎么解决的
- 每一步都跑了 `npm --prefix web run typecheck && npm --prefix web run build`、`npm --prefix web test`（145 条）和 `python3 -m unittest discover -s tests`。
- 每次构建后都用规则级 diff 对照拆包前的 `index.css`。
- `.ai-kit/hooks/check-structure.sh` 与 `check-design.sh` 均通过：新文件都在 200 行以内，组件有头部注释，没有字面量颜色。
- 浏览器实测：用临时数据目录加载样本库，不碰 `data/`。
  - **首屏**：页面 chunk 与 `/api/state` 并行加载，控制台无报错；页签重新可见时 `/api/state` 回 304。
  - **桌面切页**：国内 / 海外 / 账本 / 展示各页正常。
  - **保存**：批量「标记上架」后，`/api/state` 只回 1 条记录和 4 条审计的增量，界面随即显示「已上架」。
  - **抽屉**：打开详情时压入守卫条目；进入艺人页是第二层；浏览器后退回到详情；× 关闭后守卫条目退掉，hash 不变。
  - **手机 375 宽**：
    - 底栏数量与胶囊位置正确。
    - 库存 → 在途：`page-in-right` 加底层快照；在途 → 库存：`page-in-left` 加上层快照。动画结束后快照、锁类全部清除，历史栈长度不变。
    - 库存 → 展示：由 `splash-veil` 幕布接管转场。

## 可能带来的新问题
- 新增页面要在 `App.tsx` 写一行 `lazyPage` 声明，再在分发里加一行。AGENTS.md 已同步。
- 首屏要等所有页面 chunk 到齐，总下载量与拆包前相近。收益在于主包解析更快、多个文件并行下载；静态资源本来就是 `no-cache` 加 ETag，发布后只有改动过的 chunk 需要重新下载，其余回 304。若以后要做「首屏只下当前页」，需先解决切页动画对同步渲染的依赖。
