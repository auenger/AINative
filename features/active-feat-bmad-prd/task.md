# Tasks: feat-bmad-prd

## Task Breakdown

### 1. Prompt
- [ ] `prd-prompts.ts` — PRD_SYSTEM_PROMPT + 发现阶段/Fast Path/Coaching Path/验证/定稿提示

### 2. 发现阶段组件
- [ ] `IntentSelector.tsx` — 意图选择 3 芯片 (Create/Update/Verify)
  - `px-3 py-1.5 rounded-full border text-[10px] font-bold` selected: `bg-primary/10 border-primary/20`
- [ ] `WorkModeSelector.tsx` — 路径选择 2 大卡片 (Fast/Coaching)
  - `grid grid-cols-2 gap-3` selected: `border-primary/30 bg-primary/5`

### 3. PRD 文档预览
- [ ] `PRDDocumentPreview.tsx` — 右侧文档预览（大纲 + 内容）
  - 大纲导航 w-[200px]: 章节状态图标 (CheckCircle2/Loader2/Circle) + 标题 + 假设徽章
  - 文档内容 flex-1: MarkdownRenderer
- [ ] `AssumptionTag.tsx` — [ASSUMPTION] 交互标签
  - 徽章: `bg-warning/10 border-warning/20 text-warning text-[9px] rounded`
  - Popover: 假设文本 + [确认](→绿色) + [编辑](→inline textarea)

### 4. 验证与定稿
- [ ] `ValidationReport.tsx` — 7 维度验证报告
  - 维度行: 名称 + 评分徽章(A/B/C/D 色彩) + 进度条
  - 可折叠 findings: severity badge + 标题 + 位置 + 建议
  - 弱/问题默认展开，强/适当默认折叠
- [ ] 定稿清单 UI（7 步 checklist + Create Feature 按钮）

### 5. PrdCreationPanel 面板
- [ ] 创建 `PrdCreationPanel.tsx`
- [ ] 左右分屏: WorkshopChatPanel (左 ~45%) + 拖拽分隔条 + PRDDocumentPreview (右 ~55%)
- [ ] 拖拽分隔条: 复用 MarkdownSplitView 的 onMouseDown 模式 (w-1.5 cursor-col-resize)
- [ ] 自定义消息渲染: intent-selector / stake-calibration / work-mode-selector
- [ ] PRD 文档状态同步: Agent 输出 → PRDDocument state → PRDDocumentPreview 更新
- [ ] Agent 集成: useAgentStream + PRD_SYSTEM_PROMPT

### 6. Feature 衔接
- [ ] "Create Feature" 按钮调用 createFeature / create_feature_from_agent IPC
- [ ] PRD → Feature spec.md 转化映射
- [ ] PRD 文件保存到工作区

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | PRD 创建子 Feature |
