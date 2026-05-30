# Tasks: feat-workshop-chat-ux-polish

## Task Breakdown

### 1. OPTIONS 按钮显示 DESCRIPTION
- [x] 增强 `parseWorkshopMarkers()` 支持 `[SYSTEM]` OPTIONS JSON 格式解析
- [x] 修改 `OptionCardMessage` 确保按钮主文本显示 DESCRIPTION 而非 ID
- [x] 在 `WorkshopChatBubble.tsx` 的 `filterToolCallText` 中过滤 OPTIONS JSON 原始文本
- [x] 验证 Brainstorm / Party Mode / PRD 三个面板的 OPTIONS 渲染

### 2. INIT 系统消息隐藏
- [x] 在 `useAgentStream.ts` 中识别 INIT 模式（`[SYSTEM]INIT` 或 `INIT —`）
- [x] 将 INIT 消息路由到 `agentStatus` 状态而非消息列表
- [x] 在 `WorkshopMessageRenderer` 中显示 "Thinking..." 指示器
- [x] 当实际内容到达时清除 INIT 状态

### 3. Tool Call 噪音过滤
- [x] 增强 `filterToolCallText()` 过滤 `[tool: xxx] {json}` 模式
- [x] 过滤 `task_started` / `task_progress` / `task_notification` 标记
- [x] 简化 `ToolCallMessage` running 状态为 "Working..." spinner
- [x] 验证三个面板的工具调用显示

### 4. Party Mode 面板重构
- [x] 确认 roster 后完全隐藏 Recommended Panelists（检查现有逻辑）
- [x] 将右侧面板改为 Tab 式布局（角色 Tab + All Tab）
- [x] Tab 标签显示 emoji + 角色名称
- [x] 点击 Tab 切换查看对应角色的分析内容
- [x] 保留 "All" Tab 垂直展示所有角色

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-29 | Feature created | 4 个优化点，涉及 6 个核心文件 |
| 2026-05-29 | All tasks implemented | 7 files modified, TS type check passed |

## Files Changed

### Modified (in worktree)
1. `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatBubble.tsx` — 增强 filterToolCallText（tool call 噪音 + OPTIONS JSON 过滤）
2. `neuro-syntax-ide/src/components/pm-workshop/WorkshopMessageRenderer.tsx` — ToolCallMessage 简化 + ThinkingIndicator
3. `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatPanel.tsx` — 新增 agentStatus prop 透传
4. `neuro-syntax-ide/src/components/pm-workshop/BrainstormPanel.tsx` — parseWorkshopMarkers 支持 [SYSTEM] OPTIONS JSON + agentStatus 透传
5. `neuro-syntax-ide/src/components/pm-workshop/PartyModePanel.tsx` — Tab 式角色面板 + agentStatus 透传
6. `neuro-syntax-ide/src/components/pm-workshop/PrdCreationPanel.tsx` — agentStatus 透传
7. `neuro-syntax-ide/src/lib/useAgentStream.ts` — INIT 检测 + agentStatus 状态
8. `neuro-syntax-ide/src/lib/usePartyAgentPool.ts` — 修复已有 TS 错误（字符串引号不匹配）
