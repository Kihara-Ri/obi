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
- 关闭并重开、切换备用模型后再返回；应正常创建 WebGL，旧画布的延迟事件不能影响新画布。
- 点击「使 WebGL 上下文丢失」；应回退 CSS，前后面各使用对应四色棋盘区域，无扫描图白边，内页没有空白袋面遮挡。CSS 只提供包装查看。
- 改变浏览器宽度后，正常模型仍可取放两张 CD；浏览器控制台无异常（主动丢失上下文的预期日志除外）。
- CSS 回退中展开包装，分别切换照片遮挡与抽屉收起遮挡：Enter 暂时不能改变开合；关闭遮挡后恢复。遮挡判断由碟渡 hook 负责，恢复不能重置姿态。

完成后删除 `static/model-regression/` 构建产物，避免带入部署包。
