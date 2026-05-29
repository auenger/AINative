# Tasks: feat-bmad-workspace

## Task Breakdown

### 1. 类型扩展
- [x] `types.ts` ViewType 新增 `pm-workshop`
- [x] `types.ts` 新增 PMWorkshopTab, BrainMethod, BrainstormIdea, PartyPersona, PRDSection, Assumption, BMADSessionState 等类型
- [x] `useAgentStream.ts` ChatMessage 扩展 workshopType/workshopPayload

### 2. 导航与视图注册
- [x] `SideNav.tsx` navItems 在 index 1 插入 pm-workshop (FlaskConical 图标)
- [x] `App.tsx` 新增 PMWorkshopView 视图挂载
- [x] `i18n.ts` 新增 nav.pmWorkshop 等翻译键

### 3. PMWorkshopView 主视图
- [x] 创建 `PMWorkshopView.tsx`（header h-14 + 子 Tab Bar + 面板容器）
- [x] Header: 标题 "PM Workshop" + 产出物指示器 badges
- [x] Tab Bar: [Brainstorm] [Party Mode] [Create PRD] 三按钮切换
- [x] Tab 样式: active `text-secondary border-b-2 border-secondary` / inactive `text-on-surface-variant`

### 4. 共享聊天组件
- [x] 创建 `WorkshopChatPanel.tsx`（从 ProjectView:784-930 提取）
- [x] Props: messages, isStreaming, onSendMessage, placeholder, renderWorkshopMessage, inputAddons, rightPanel
- [x] 消息渲染优先级: renderWorkshopMessage → ToolCallMessage → user bubble → assistant bubble
- [x] 创建 `WorkshopChatBubble.tsx`（提取通用消息气泡）
- [x] 创建 `WorkshopMessageRenderer.tsx`（消息类型路由）

### 5. 子面板 Placeholder
- [x] BrainstormPanel placeholder
- [x] PartyModePanel placeholder
- [x] PrdCreationPanel placeholder

### 6. 共享状态
- [x] BMADSessionState 管理（activeTab, brainstormOutput, partyInsights, prdDocument）
- [x] 各 Panel 通过 props 接收/更新 sessionState

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | 基础设施子 Feature |
| 2026-05-29 | Implementation complete | All 6 task groups done, TypeScript clean |
