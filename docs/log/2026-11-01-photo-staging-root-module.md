# 2026-11-01 · 照片暂存模块移到根目录，消除 storage↔server 导入环

## 问题

`python3 tools/run_tests.py` 全红：16 个模块、356 项失败，报错都是
`ImportError: cannot import name 'SCHEMA' from 'storage'`。

导入环：`storage.py` → `server/__init__.py` → `server/http.py` → `server/routes.py` → 回到 `storage`。
`app.py` 不受影响（它先导入 `server` 包，`from package import submodule` 会回退导入子模块，环被绕开）；
先导入 `storage` 的入口全炸：`python3 -c "import storage"`、`tools/seed_samples.py`、`tools/preview_samples.py`、多数测试模块。

根因是工作区新增的照片暂存功能让 `storage.py` 反向 `from server import photo_uploads`：
根目录业务模块依赖 `server/` 包，而 `server/routes.py` 又依赖 `storage`，方向相反即成环。

## 改动

按结构修：把模块放到它本来该在的层，环从结构上消失（不用函数内延迟 import 绕开）。

- `server/photo_uploads.py` → `photo_uploads.py`：根目录业务模块，与 `covers.py` / `backups.py` 同层；
  只依赖 `domain`，不 import `server/`，导入零副作用。
- `storage.py`：`from server import photo_uploads` → `from photo_uploads import staged_bytes`；
  调用点 `photo_uploads.read(...)` → `staged_bytes(...)`（函数随模块一并改名，读暂存照片的字节，语义更明确）。
- `server/routes.py`：`from . import photo_uploads` → `from photo_uploads import MAX_BYTES, stage`
  （与 `server/artists.py` 的 `from covers import artwork_url` 同一风格）。
- `tools/update_release.py`：`PACKAGE_ROOTS` 补 `photo_uploads.py`——裸机补丁包的路径校验会拒收未登记的根级文件，
  `tests/test_updates.py` 有对账测试防止再漏。
- 文档：`AGENTS.md` 根目录业务模块清单 + 单向分层说明；`README.md` 结构块；`使用说明.md` 代码结构。

Dockerfile 的 `COPY *.py ./` 与 `tools/package_app.py` 的 `root.glob('*.py')` 自动包含新模块，清单无需改。

## 验证

- 两种导入顺序都正常：`python3 -c "import storage"`、`python3 -c "import server, storage"`、`python3 -c "import app"`。
- `python3 tools/run_tests.py` 全绿。
- `python3 tools/check_docs.py`、`tools/check-data-leak.sh` 通过。

## 遗留

照片逐张上传（暂存接口 `/api/photos/stage`、前端 `core/photo-transfer.ts`）的文档与 CHANGELOG 仍由该功能本身补齐，本次只修模块位置与分层。
