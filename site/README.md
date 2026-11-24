# Obi 介绍站（`site/`）

Obi 的公开介绍页，Astro 生成的纯静态站，发布到 GitHub Pages。与应用本体（`server/`、`web/`、`static/`）完全分开：不进 Docker 镜像，也不进发布包。决策见 [D-044](../docs/DECISIONS.md)。

## 本地预览与构建

```sh
npm --prefix site ci
npm --prefix site run dev      # http://localhost:4321
npm --prefix site run build    # 产物在 site/dist/
npm --prefix site run check    # 检查产物没有内联脚本与样式（CSP）
```

## 规则

- **颜色只来自 token**：直接引用应用的 `web/src/styles/tokens.css`，站点只在 `site/src/styles/tokens.css` 补充排版和间距变量，不写字面量颜色（`.ai-kit` 设计检查覆盖 `site/src`）。
- **CSP 无内联**：页面头部带 CSP meta；样式外链、脚本是外链 ES module。
- **开屏动画**：`components/Intro.astro` + `scripts/intro.ts`，素材是应用图标拆出的三层 `public/intro/{back,record,sleeve}.svg`（品牌素材，颜色与 `static/favicon.svg` 一致，改图标时同步）。每个会话只播一次（sessionStorage），减少动态效果时不出现，点击或按键跳过；没有脚本时 2.5 秒后自动隐藏。
- **封面墙只用像素图**：上墙的专辑由 `cover-wall.json` 决定——顺序即上墙顺序，`show:false` 留在清单但不上墙，`size`/`colors` 调像素精度；`cover` 填图片网址或相对 `site/` 的本地路径。改完运行 `python3 site/scripts/pixel-covers.py`，生成 `public/covers/*.png` 与 `src/covers.json` 后一起提交。只放真实专辑；原图只缓存在 `site/.cover-cache/`（不进仓库）；不放个人数据。
- **「接口」页**：`pages/api.astro` + `components/ApiToc.astro`（汇总栏）、`ApiTool.astro`（MCP 工具）、`ApiGroup.astro`（HTTP 路由组）、`ApiFields.astro`；数据在 `lib/api-mcp.ts`、`lib/api-http.ts`、`lib/api-app.ts`，逐条对照 `server/routes.py`、`server/mcp_tools.py`、`server/mcp_prompts.py`，与 `docs/HTTP接口一览.md`、`docs/MCP接入.md` 同步，改一处要改另一处。
- **少字**：每个区块只留标题、短标签和必要的命令。

## 发布

推送到 `main` 且改动了 `site/` 或 `web/src/styles/tokens.css` 时，`.github/workflows/site.yml` 自动构建并发布。首次使用要在仓库 Settings → Pages 把 Source 设为 **GitHub Actions**；自定义域名也在那里绑定，不在仓库里提交 `CNAME`。
