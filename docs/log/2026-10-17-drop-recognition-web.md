# 2026-10-17 · 前端：移除照片识别、批量录入与数字实体生成界面

- **作者**：Claude
- **范围**：`web/src/{components,forms,pages,state,core,types.ts,styles,main.tsx}` `web/tests/*` `.ai-kit/legacy.txt`

## 改了什么
删除 VisionSettings、Recognition、BatchForm（批量照片录入）、GuidedTwinEditor、`recognition.css`；单张录入去掉「识别并补全」与识别依据；库存页头去掉「批量录入」；设置「高级」去掉 AI 照片识别与数字实体生成的模型配置；`TwinControls` 改为只显示已有实体状态并保留附件编辑与盘面校准（保存前禁用）；`useDigitalTwins` 去掉 `startTwin/cancelTwin`；`core/recognition.ts` 改名 `core/release-text.ts`（仅剩发行资料标签与上架描述文字）；相应更新测试。

## 出现的问题
界面里还保留着已弃用的 AI 识别和宿主生成入口，且会请求已删除的接口。

## 怎么解决的
按「只查看、校准、保存已发布实体」收缩界面；发行版检索用 `/api/release-details`。

## 可能带来的新问题
编辑页「数字实体」折叠区的标题仍写「同版 Cover Art Archive 图集」；前端 115 项测试通过，3D 浏览器验收未重跑。

## 关联
D-005
