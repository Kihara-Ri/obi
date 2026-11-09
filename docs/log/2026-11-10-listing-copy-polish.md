# 2026-11-10 闲鱼上架文案清洗增强与结构去重

## 决策背景
在第一轮文案调整后，实际测试中大模型仍有把附件说明粘连至末尾交易说明行（如“含透明胶盒外层塑料套。 个人闲置转让...”）的情况。
为保证真人口吻纯净无冗余，补充正则拦截剥离此类粘连包装字句。

## 改动清单
- `server/listing_copy_clean.py`：新增 `TRAIL_ATTACHMENT_PREFIX`，剥离交易说明前重复拼接的包装与附件句式。
- `tests/test_listing_copy_clean.py`：扩充清洗测试用例。

## 验证
- 后端 `python3 tools/run_tests.py` 全绿（620 项测试）。
- 前端 `npm --prefix web test` 全绿（184 项测试）。
- `tools/check-data-leak.sh` 和 `python3 tools/check_docs.py` 全绿。
