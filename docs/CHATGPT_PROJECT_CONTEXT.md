# 专辑助手 · 碟渡项目上下文（供 ChatGPT Project 引用）

> 更新：2026-10-13。此文档仅收录公开代码架构与产品约束；不收录个人收藏、数据库、访问地址、密码、令牌或运维资料。实际代码与 `AGENTS.md` 优先于此摘要。

## 定位
项目名「碟渡」（仓库 `music-watari`）：个人 CD 实物收藏、发行版核对、购入/运费/交易成本与海外周转、收藏展示、3D 数字实体。**一张实物副本对应一条独立记录**，发行版（release）和实体副本（copy）必须区分。四个可选模块为 showcase、acquisition、trading、circulation。

## 技术和路径
- `app.py` 服务组装入口；`server/context.py` 服务注入；`server/routes.py` HTTP API 路由（新接口只在此加，不写进 `server/http.py`）。
- `storage.py` SQLite 事务、成本、销售、运单与备份接口，**不可绕过它直接修改真实数据库**；`domain.py` 校验与 Decimal 金额语义。
- `musicbrainz.py` 共享节流 MusicBrainz 请求客户端；`server/recognition.py` 编号检索、发行资料/曲目补全与照片识别；`covers.py` iTunes / MusicBrainz / Cover Art Archive 封面。
- `server/digital_twins.py` 实物条形码核对与数字实体生成；`web/vendor/` 固定版本专辑引擎；`web/src/components/AlbumModel.tsx` 3D 展示。
- `web/src/` React 19 + TypeScript + Vite，`core/` → `components/` → `forms/` / `pages/` 单向依赖，`web/src/state/AppContext.ts` 唯一应用状态入口。
- `web/src/forms/RecordForm.tsx` 添加/编辑、`DetailDrawer.tsx` 详情底部操作、`web/src/components/SaleCard.tsx` 交易卡片、`web/src/pages/GalleryPage.tsx` 九模式收藏展示；运动逻辑在 `web/src/components/useGalleryMotion.ts` 与 `web/src/components/useGalleryRoaming.ts`。
- `web/src/styles/` 每模块独立 CSS；构建产物在 `static/assets/`，服务端直接读取这些文件。

## 当前产品决定（2026-10-13）
1. 专辑详情底部按钮按**编辑与上架 / 库存流转与交易**分两组，可换行，始终不应越过抽屉。交易卡片「修改费用」靠右。
2. 九种展示模式都应正确响应各自速度设置。翻阅/唱片箱/扇形/环形的单位是「秒（切换前停留）」；等距封面墙沿三列斜向连续轨道运动，单位「秒/排」；其余连续布局为「秒/张」。每种模式分开保存 2–30 秒偏好；减少动态效果与打开抽屉时暂停。
3. 添加/编辑专辑只在上方维护一份完整条形码（GTIN-8、UPC-A、EAN-13、GTIN-14，须通过校验位核验）；MusicBrainz 精确查询 CD 发行版，多个候选用户确认；名称与艺人自动填充，不要求手动输入。确认结果保存为 `releaseInfo.musicBrainzReleaseId`（UUID）和 `releaseInfo.barcode`，重开编辑仍保留发行版，不重复选版；旧记录无 release ID 可以继续编辑。
4. “存放位置”从添加、编辑、详情及卡片展示移除；原 `storage` 数据保留以兼容旧账本，不再新增 UI 输入。保留购买金额、币种、日期、渠道、入库位置（仅流转模块）、实物照片、两个备注。额外买入费用靠近购买金额显示。
5. 数字实体复用上方已保存发行版：Cover Art Archive 图集和自动封面按 **精确 release UUID** 检索；没有同版图时给出缺失提示，绝不借用同名其他版本。数字实体移除独立条形码输入、背面照片按钮和第二次选版；实际生成需用户手动点击，视觉模型调用不随查看或保存自动触发。`releaseInfo.musicBrainzReleaseId` 为实体任务稳定来源，后端再次核对该版本的条形码和 CD 介质。`note` 和 `noteAlbum` 两个备注继续保留，数据库其他历史字段不迁移。
6. 后续由用户提供具体几张专辑的条形码，先查看 MusicBrainz 实际返回的字段与可用性，再讨论最终数据模型该删什么、留什么；**目前不执行数据库字段迁移**。

## 不能破坏的契约
- 成本未知为 `null`，不是 0；金额服务端 Decimal、前后端以字符串传输；汇率与运费分摊合计须守恒。
- 真正的个人数据放在未跟踪 `data/`，绝不写进文档/仓库/测试；不要碰真实 `data/*.sqlite3`。
- 变更源码后验证：`python3 -m unittest discover -s tests -q`、`npm --prefix web run typecheck`、`npm --prefix web run test`、`npm --prefix web run build`；UI 用 `tools/seed_samples.py` 的 21 副本虚构样本在独立临时目录验收。
- 既有未提交改动不要覆盖；部署、发布、打 tag 须另行确认；遵守 `AGENTS.md`、`AI开发复盘.md` 和 `docs/模块扩展指南.md`。

## 上下文同步办法
本文件是*摘要*，不能代替阅读代码。ChatGPT 对话通过 Remote Desktop Commander 可连接授权设备并阅读仓库；如果希望本 ChatGPT Project 的每个对话不依赖远程连接就能检索上述摘要，需要将**此文件的副本上传到项目文件**。以后影响架构、业务规则和数据契约的变更，更新仓库 `AGENTS.md` 和这份文档，然后同步项目文件。不要将整个 `data/` 或敏感配置上传 ChatGPT Project。
## 2026-10-13 后续核查与新渠道
- 新购买渠道：保存成功后由 `server/shop_brands.py` 异步通过 Pi CLI 补全可能的官方 favicon，未识别保留首字图标；元数据缓存于 `shop-brand-cache-v1`，图标数据在数据目录的 `shop-icons/`。OAuth/API Key 由 Pi 用户目录管理；配置细节见 `docs/PI_SHOP_BRANDS.md`。
- ChatGPT OAuth 本机已存在 Pi 登录凭据，但调用在账户额度限制处失败，不能宣称完全端到端正常。
- Album Engine 0.1.1 已解耦模型查看器和材质/动作，但生成工作流目前仍在碟渡 `server/digital_twins.py`；该边界不能混淆。
