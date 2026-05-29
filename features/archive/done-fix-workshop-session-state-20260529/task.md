# Tasks: fix-workshop-session-state

## Task Breakdown

### 1. PMWorkshopView — 条件渲染改 CSS 隐藏
- [x] 修改 PMWorkshopView.tsx: 将 `{activeTab === X && <Panel />}` 改为始终挂载 + CSS `hidden`
- [x] 给 BrainstormPanel / PartyModePanel / PrdCreationPanel 添加 `className` prop 支持

### 2. Panel Header — 新建会话按钮
- [x] BrainstormPanel header 增加 RotateCcw "新建会话"按钮，调用 `agent.newSession()` + 重置 steps/ideas
- [x] PartyModePanel header 增加 RotateCcw "新建会话"按钮，调用 `orchestrator.newSession()` + 重置 rounds/insights
- [x] PrdCreationPanel header 增加 RotateCcw "新建会话"按钮，调用 `agent.newSession()` + 重置 prdPhase/sections

### 3. 工具调用渲染过滤
- [x] WorkshopChatBubble 中对 assistant content 预处理，过滤 tool_use/tool_result XML 标签
- [x] 过滤 `<tool_use>` 和 `<tool_result>` 标签包裹的内容
- [x] 保留纯 Markdown 文本传给 MarkdownRenderer

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Created | 初始任务分解 |
| 2026-05-29 | Implemented | 全部 3 个 Task 已完成 |
