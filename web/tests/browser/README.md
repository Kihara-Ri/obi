包装灯箱生命周期回归页只读取固定样本库，不创建或修改记录。先在空的临时目录运行 `tools/seed_samples.py --with-models --data-dir <目录>`，再用 `app.py --no-seed --data-dir <目录> --port <空闲端口>` 启动。

在仓库根目录编译回归页：

```sh
node --input-type=module - <<'JS'
import {build} from './web/node_modules/vite/dist/node/index.js';
await build({configFile:false,root:'web/tests/browser',base:'/model-regression/',build:{outDir:'../../../static/model-regression',emptyOutDir:true,rollupOptions:{input:'web/tests/browser/album-model.html'}}});
JS
```

访问 `/model-regression/album-model.html`：

- 展开包装并取出 CD，点击「重新获取副本」数次；应保留 WebGL、旋转、开合与 CD 姿态。旧实现第一次刷新即退回 CSS 并报告 renderer precision 错误。
- 关闭并重开；应正常创建 WebGL，旧画布的延迟事件不能影响新画布。
- 点击「使 WebGL 上下文丢失」；应退出 WebGL 并报告返回 2D；引擎不再创建 CSS 替代模型。实际收藏灯箱须显示 2D 封面。
- 改变浏览器宽度后，正常模型仍可取放两张 CD；浏览器控制台无异常（主动丢失上下文的预期日志除外）。

完成后删除 `static/model-regression/` 构建产物，避免带入部署包。

真实封面与 3D 参考实体的自动验收统一用 `showcase-acceptance.mjs`。先由固定离线素材包初始化独立样本目录、运行 `tools/preview_samples.py check` 输出 JSON，再启动该目录的服务：

```sh
npm --prefix web run test:browser -- --url http://127.0.0.1:<空闲端口> --expectations <check.json>
```

CI 安装 Playwright 后直接运行；本地已有工具自带 Playwright 时可设置 `OBI_PLAYWRIGHT_MODULE` 为其模块路径，无需新增应用运行依赖。设置 `OBI_PREVIEW_SCREENSHOTS` 可保存三个模型及银色/金色收藏卡截图。工具环境也可以导入 `accept(page, {baseURL, expectations})`，或注入它的函数正文；函数不依赖 Node 模块。

验收读取真实已发布实体与真实图片，并逐份比对素材 SHA-256。16 张图库封面必须全部解码、不能是占位符；三个实体的正背面、内页、盘面、附件及附件背面必须由查看器请求。覆盖默认/重开 2D、按需 GLB、查看器挂载与全部贴图加载、桌面/手机全屏画布、上下文丢失后回 2D 与显式重试；包装的开合、旋转、CD 2 独立取放等 3D 动作属于 Album Engine，由引擎项目验收，不在宿主 CI 里验证；控制台错误和 HTTP/传输失败使验收失败。不会创建、修改或发布账本记录。

原 `album-flip-card.test.mjs` 和 `gallery-focus-viewport.test.mjs` 的 11 项源码字符串断言已移到此浏览器入口：

| 原有要求 | 运行中验证 |
|---|---|
| 正反面、收藏日期、可访问翻转 | 实际点按、`aria-pressed`/`aria-hidden`、日期文字和返回正面 |
| 默认银色、喜欢为金色；展示页不可编辑喜欢 | 只替换喜欢目录的只读响应，检查两种实际材质/截图；不写入账本 |
| 模型及共用封面缩放保留 | 真 GLB、模型就绪和封面动画两端的原图比例/缩略图起点 |
| 真实金属 HDR/PBR 反射 | HDR 请求成功、金属画布实际 rendered、两种材质截图供视觉复核；不再锁死 PBR 数字或相机类名 |
| GPU 清理与翻回材质 | 翻回和重开，关闭后画布删除且 GPU 上下文释放 |
| 原 HDR 无鼠标聚光层 | HDR 请求、无伪元素光层、整卡倾斜和移开复位；截图复核反射 |
| 指针仅倾斜卡片 | 实际鼠标移动、倾斜 CSS 变量和移开复位 |
| 模型填满视口、标题不裁切/阻挡 | 桌面与 390×844 手机画布坐标/尺寸、标题命中属性 |
| 2D 图片为命中区、空白点击关闭 | 实际点封面翻转、点空白关闭、重开复位 |
| 普通光标、导航可用 | 灯箱普通光标；实际换张/返回、重置翻面与 2D |
| 缩放两端保持图片比例 | 检查实际 Web Animations keyframes，几何算法单测继续保留 |

浏览器证明加载与交互链路；金属外观、贴图方向/裁切、穿模仍要查看真实截图。它不等于实机感应或帧率验收。原 `album-model.html` 为隔离几何/生命周期专项，不能替代真实样本验收。

Album Engine 插件生命周期验收用 `engine-plugin-acceptance.mjs`，同样吃 `preview_samples.py check` 的期望 JSON，但按 `--stage` 分四段执行，服务重启与备份/恢复由外部编排：

```sh
node web/tests/browser/engine-plugin-acceptance.mjs --url http://127.0.0.1:<空闲端口> --expectations <check.json> --stage <full-ui|uninstall-while-viewing|after-restart|reinstall-view>
```

- `full-ui` 会先卸载（若已装）、驱动一条可变探针记录走创建/编辑/回收，再做「同任务双击安装」——必须恰好前进一个 revision（Playwright 的动作等待会把排队的第二击落到装完后重渲染出的「卸载」键上，等于真卸载；须用一次 evaluate 内的两次同步 click 模拟真实双击）；随后 3D 从 `/api/twin-model-assets/` 的固定 GLB 渲染、无实体记录保持 2D。
- `uninstall-while-viewing` 用同一浏览器上下文的第二页在 A 页看 3D 时卸载；A 页须释放画布与挂载点、开关消失、卸载标记后零插件资产请求。
- `after-restart` 在服务重启后验证未安装状态持久化、图库与灯箱仅 2D；重启前后的 `/api/twins` 应在去掉 epoch/revision 后逐字段一致。
- `reinstall-view` 经 UI 安装（若未装）并确认同一固定 GLB 再次渲染；它不改写账本数据，可对演示实例安全复跑。

探针记录名「引擎验收临时」；中断的运行可能把它留在库里（表现为图库 17 张、首张占位封面），下一段 `full-ui` 会自动清理，或 `preview_samples.py prepare --rebuild` 重建固定开发目录。期望 JSON 绑定当次种子实例的记录 ID，重建后须重新生成。控制台错误与 HTTP/传输失败一律判失败。

## 售卖草稿与图片包

先用独立 `OBI_DEV_HOME` 运行 `python3 tools/preview_samples.py prepare --download`。再调用 `tools.seed_samples.seed_listing_reference_photos(<固定样本 instance 目录>)`：复用锁定的真实版次参考图片，备注明确标为非本副本实拍，不生成品相证明。`seed_listing_photos` 只供离线协议单测使用合成图片；普通样本保持缺图。

```sh
python3 tests/serve_listing_acceptance.py --data-dir /path/to/sample-home/instance
# 将上一步打印的本机空闲端口地址填入：
LISTING_ACCEPTANCE_URL=http://127.0.0.1:<空闲端口> node web/tests/browser/listing-acceptance.mjs
```

测试服务只接受固定样本目录，启动本机模拟 Chat Completions 上游；浏览器通过真实 API 通道依次验证：多服务商切换、DeepSeek 保存密钥/读取真实协议模型目录/仅文字模型禁选/思考强度持久化、兼容 API 静态模型就绪、DeepSeek 参数经过模拟 HTTP 上游校验、分析轮询、保留手写正文、人工确认生成、复制到剪贴板、选图排序/首图、ZIP 下载、保存不标记上架、重开持久化、手机宽度、并发草稿冲突。CI 在完整真实封面/模型验收结束后运行，不影响前一阶段样本契约。截图与图片包放入 `OBI_PREVIEW_SCREENSHOTS` 指定目录（默认 `/tmp/obi-listing-browser`）。

该验收使用模拟模型，不能证明真实 OAuth 授权成功、模型可用性、照片版本或品相准确率。真实 OAuth 需用户完成授权，选择视觉模型后以实拍副本单独验收。正常流程要求 console/pageerror 为零；并发保存用例仅允许预期的 HTTP 400 诊断。
