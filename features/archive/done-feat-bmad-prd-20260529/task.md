# Tasks: feat-bmad-prd

## Task Breakdown

### 1. Prompt
- [x] `prd-prompts.ts` — PRD_SYSTEM_PROMPT + 发现阶段/Fast Path/Coaching Path/验证/定稿提示

### 2. 发现阶段组件
- [x] `IntentSelector.tsx` — 意图选择 3 芯片 (Create/Update/Verify)
- [x] `StakeCalibration.tsx` — 利益校准 3 芯片 (Hobby/Internal/Startup)
- [x] `WorkModeSelector.tsx` — 路径选择 2 大卡片 (Fast/Coaching)

### 3. PRD 文档预览
- [x] `PRDDocumentPreview.tsx` — 右侧文档预览（大纲 + 内容）
- [x] `AssumptionTag.tsx` — [ASSUMPTION] 交互标签

### 4. 验证与定稿
- [x] `ValidationReport.tsx` — 7 维度验证报告
- [x] `FinalizationChecklist.tsx` — 定稿清单 UI（7 步 checklist + Create Feature 按钮）

### 5. PrdCreationPanel 面板
- [x] 创建 `PrdCreationPanel.tsx`（完整重写）
- [x] 左右分屏: WorkshopChatPanel (左 ~45%) + 拖拽分隔条 + PRDDocumentPreview (右 ~55%)
- [x] 拖拽分隔条: 复用 MarkdownSplitView 的 onMouseDown 模式
- [x] 自定义消息渲染: intent-selector / stake-calibration / work-mode-selector
- [x] PRD 文档状态同步: Agent 输出 → PRDDocument state → PRDDocumentPreview 更新
- [x] Agent 集成: useAgentStream + PRD_SYSTEM_PROMPT

### 6. Feature 衔接
- [x] "Create Feature" 按钮调用 create_feature_from_agent IPC
- [x] PRD → Feature spec.md 转化映射
- [x] PRD 文件保存到工作区 (handleSavePrd)

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | PRD 创建子 Feature |
