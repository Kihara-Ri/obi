# 2026-10-21 · 修复 CI 售卖草稿验收

- **作者**：Claude
- **范围**：`web/tests/browser/listing-acceptance.mjs`

## 现象
GitHub CI 的「真实封面与模型贴图浏览器验收」job 在「售卖草稿与图片下载验收」步骤失败（等不到「分析本副本照片」按钮）。3D 贴图验证那一步是通过的，与 3D 模块无关；其余 job 全绿。

## 原因
上架表单改版（4e16432）后控件文字变了，验收脚本没跟着改：按钮「(重新)分析本副本照片」→「开始分析 / 重新分析」；「采用照片观察到品相说明」→「采用照片观察到的品相说明」；版本说明输入框的可访问名从「版本说明（不确定的内容留空）」变为「版本说明」+小字。

## 改动
只改脚本里的三处选择器，业务代码不动。

## 验证
本地按 CI 同样的方式（`preview_samples prepare --download` → `serve_listing_acceptance` → `listing-acceptance.mjs`）跑通，输出 `passed: true`。
