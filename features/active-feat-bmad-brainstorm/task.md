# Tasks: feat-bmad-brainstorm

## Task Breakdown

### 1. 数据与 Prompt
- [ ] `brain-methods.ts` — 60+ 技术数据（9 个类别）
- [ ] `brainstorm-prompts.ts` — BRAINSTORM_SYSTEM_PROMPT + 4 步引导提示

### 2. 核心组件
- [ ] `ProgressStepper.tsx` — 4 步进度条（Setup→Technique→Execute→Organize）
  - 完成: text-tertiary + CheckCircle2 / 当前: text-primary + 实心点 / 待定: opacity-50 + 空心圆
- [ ] `IdeaCounterBadge.tsx` — 持久想法计数徽章（💡 42 ideas）
- [ ] `OptionCardMessage.tsx` — 2x2 选项选择卡片网格
  - `grid grid-cols-2 gap-2` + `bg-surface-container-low border rounded-lg p-3 hover:border-primary/30`
- [ ] `IdeaCardMessage.tsx` — 结构化想法卡片
  - 类别标签 text-[9px] uppercase + 标题 text-xs font-bold + 概念/新颖性 text-[10px]
- [ ] `EnergyCheckpointMessage.tsx` — 能量检查点（bg-warning/5 + 操作按钮组）
- [ ] `ActionMenuMessage.tsx` — 内联操作按钮（flex gap-1.5 flex-wrap）

### 3. BrainstormPanel 面板
- [ ] 创建 `BrainstormPanel.tsx`
- [ ] 布局: ProgressStepper (顶部) + Header (含 IdeaCounterBadge) + WorkshopChatPanel
- [ ] Agent 集成: useAgentStream + BRAINSTORM_SYSTEM_PROMPT
- [ ] 状态管理: BrainstormPanelState (step, topic, ideas, ideaCount, selectedTechnique)
- [ ] 自定义消息渲染: renderWorkshopMessage 处理 option-card / idea-card / checkpoint / action-menu

### 4. 产出物管理
- [ ] 想法集合序列化到 BMADSessionState.brainstormOutput
- [ ] 产出物通过 onOutputChange callback 传递给父组件

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | 头脑风暴子 Feature |
