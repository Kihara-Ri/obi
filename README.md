# Obi

> 让每一张唱片，都被好好记着。

个人 CD 收藏与交易账本：每张实物是一条独立记录，带版本、照片与成本；可以只整理、只展示，也可以按需打开购入、二手交易与海外周转。Python 标准库后端 + React / TypeScript 前端 + SQLite，单用户，数据只存在自己的设备上；仓库是可分享的框架，不含任何个人数据。

## 能做什么

| 模块 | 内容 |
|---|---|
| 整理收藏（基础，始终可用） | 专辑、版本、实物照片、搜索、艺人资料与作品目录、备份与导出 |
| 展示收藏 | 九种触屏封面布局（封面墙、瀑布流、胶片、翻阅、唱片箱、桌面铺开、扇形展开、等距封面墙、环形展架）、艺人 / 手动组范围、可调速的自动巡游；灯箱默认 2D，可显式切 3D |
| 购入记录 | 购买日期、渠道、原币金额与额外费用；日元按购买当天欧洲央行汇率折算，缺失显示「待补」，永不当 0 |
| 二手交易 | 上架资料、售出中、成交与到账、交易历史；利润只计成本已知的明细 |
| 海外周转 | 海外库存 → 打包运输（运费均摊进成本）→ 在途 → 国内库存 → 售出，依赖购入记录 |

新实例首次打开时选择使用方式，之后可在「设置与备份 → 功能模块」调整；关闭模块只收起入口，不删除、不改写任何记录。

### 录入与资料

- **条码优先**：输入 8–14 位条码，经 MusicBrainz 精确查找 CD 发行版，由你确认后带入专辑、艺人、版号、厂牌与曲目；同时查 Deezer / iTunes（编号同时查 Discogs）并按条码合并去重，仍没有则「按未收录版本手动录入」。唱片编号同样走精确匹配，另有相机扫码。
- **查询页**：条码、编号、专辑名 / 艺人名只读查询，不入库；先列库里已有的副本。
- **封面**：iTunes / MusicBrainz / Cover Art Archive 自动匹配，也可粘贴图片地址。
- **艺人资料**：MusicBrainz 来源的身份绑定、别名、地区与作品目录；本地副本可关联到具体作品。

### 上架资料（需启用二手交易）

专辑详情 → 管理 → 编辑上架资料。AI 一键沿用已有发行资料、核对本副本照片、写出标题与正文；没有照片也能生成；文案按闲鱼发布页写（标题即描述首行、不含易被截断的符号），买家可见内容里不出现“不确定 / 待核实”，未知品相直接不写；可设首图，保存图片按首图顺序。

- 文案是一张卡片：空态就地生成或手写，长文就地展开，编辑在卡内；底栏常驻「保存图片 / 复制文案」，之后到闲鱼手动发布。
- 新草稿自动保存；已有文案先展示候选，采用后才替换；保存草稿不改变上架状态。
- 识别服务商：OpenAI（ChatGPT OAuth）、DeepSeek（API Key）、Anthropic（官方 Claude Code OAuth）、OpenCode（Beta）与兼容 API，按服务商读取模型与思考强度。配置见[部署说明](部署说明.md#售卖照片识别)。

### 3D 实体（可选插件）

Album Engine 是独立项目，宿主只管插件安装 / 卸载（设置 → 唱片实体引擎）、资产授权与 `storage.py` 事务；模型、材质、装配、生成与发布都在引擎里。未安装时账本、封面、2D 展示、条码与备份完全可用；卸载保留已发布实体与参数。点击 3D 才加载 Three.js 与 GLB，WebGL 不可用或装配失败回到 2D。契约见[插件说明](docs/AlbumEngine插件.md)。

## 快速开始

**Docker（推荐）：**

```sh
git clone https://github.com/Kihara-Ri/obi && cd obi
cp .env.example .env          # 按需填 PUBLIC_ORIGIN / 备份密钥
docker compose up -d --build  # 打开 http://127.0.0.1:8765，数据落在 ./data
```

升级 = `git pull && docker compose up -d --build`；停止 = `docker compose down`（数据保留）。

**裸 Python（零依赖，3.10+）：** `python3 app.py`；Mac 上也可双击 `启动 Obi.command`。Releases 里的 `album-ledger.tar.gz` 无需 git，裸机可开启[补丁自动更新](部署说明.md#补丁自动更新可选)。

**没有服务器：** 安卓在 [Releases](https://github.com/Kihara-Ri/obi/releases) 下载 `Obi-<版本>.apk` 直接安装；或把 `build:local` 的静态站点放到任意托管，同一套后端在手机浏览器（Pyodide）里运行，数据存本机，可断网使用，与服务器版用完整备份互通。见[部署说明](部署说明.md#方案三没有服务器本机模式主要给手机)。

公网部署（HTTPS 反代 + 登录密码 + 异地备份）见[部署说明](部署说明.md)。

## 结构

```
app.py               入口：CLI / 服务组装 / 启动（HOST / PORT / DATA_DIR / PUBLIC_ORIGIN）
server/              HTTP 层：路由表 · 静态服务 · CSV 导出（加接口只改路由表）
domain.py            金额计算与校验（Decimal，纯函数）
storage.py           SQLite 事务与持久化（五态 + 包裹 + 销售单）
rates.py covers.py   历史汇率 · 封面抓取
security.py          登录、会话与限流
backups.py           每日一致性快照
web/                 前端源码：React 19 + TypeScript + Vite
static/              构建产物与 PWA 资源
plugins/album-engine/  官方插件 ZIP 与哈希目录
android/             原生外壳（本机模式）
deploy/ tools/       systemd / nginx / Litestream 配置 · 发布、打包与样本脚本
```

## 开发与验证

```sh
python3 tools/run_tests.py                          # 后端，按模块并行；单模块：python3 tools/run_tests.py test_covers
npm --prefix web run typecheck && npm --prefix web run build
npm --prefix web test                               # 前端单测
```

- 改前端必须构建：服务端只认 `static/assets/` 产物。
- 首次 clone 先执行 `tools/setup-hooks.sh`：commit / push 前扫描个人数据，CI 再扫全历史，红灯即修复。
- 涉及专辑场景的测试一律复用固定样本库（`tools/seed_samples.py`，21 个虚构副本）。真实封面与参考模型预览：首次 `python3 tools/preview_samples.py prepare --download`，之后 `python3 tools/preview_samples.py`，见[固定样本真实贴图](docs/固定样本真实贴图.md)。
- 应用图标源为 `static/favicon.svg`，改后运行 `python3 tools/build_icons.py`（需 ImageMagick）。

## 文档

- [使用说明](使用说明.md)：状态模型、日常操作与计算口径
- [部署说明](部署说明.md)：Docker / 裸机、HTTPS 公网访问、数据容灾
- [更新记录](CHANGELOG.md)：按功能列出每次发布变化
- [AGENTS.md](AGENTS.md)：开发标准与红线（agent / 贡献者必读）
- [模块扩展指南](docs/模块扩展指南.md)：模块契约与验收场景
- [AI 开发复盘](AI开发复盘.md)、[购买渠道图标与 Pi 认证](docs/PI_SHOP_BRANDS.md)、[docs/README.md](docs/README.md)：治理文档索引

## 许可证

[AGPL-3.0](LICENSE)。修改后对外提供网络服务时，需要向使用者公开修改后的源码。

---

*收藏有来处，交易有记录。*
