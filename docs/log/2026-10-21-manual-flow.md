# 2026-10-21 · 管理页手动切换库存位置

- **作者**：Claude
- **范围**：`storage.py`（bulk）、`tests/test_ledger.py`、`web/src/forms/detail/{ManagePage,FlowSection}.tsx`、AGENTS.md、CHANGELOG

## 改了什么
- 管理页「流转」从「只读当前位置」改为海外库存 / 国内库存分段控件，点另一段即切换，toast 带「撤销」。
- 后端 bulk 新增 `to_domestic`（仅海外库存→国内库存，不碰运费分摊 / 上架标记）与 `undo_to_domestic`（按审计 + revision 连续性校验，之后又改过则拒绝）；`last_to_overseas` 抽成通用 `last_audit`。
- 在途 / 售出中 / 已售出不开放手动改：它们携带包裹运费分摊或售价，手改会让账对不上；页面给出一句去哪处理的说明。

## 验证
- 后端新增 2 个测试（手动标国内 + 撤销、在途拒绝）；浏览器（手机宽度）切海外 → toast → 撤销回国内正常。

## 待定
- 若还需要手动改「在途」等状态，需先定业务规则（运费、签收日期如何处理）再做。
