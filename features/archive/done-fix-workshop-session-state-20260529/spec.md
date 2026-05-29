# Feature: fix-workshop-session-state PM Workshop 会话状态修复

## Basic Information
- **ID**: fix-workshop-session-state
- **Name**: PM Workshop 会话状态修复 — Tab 保持 + 清除对话 + 工具调用渲染
- **Priority**: 80
- **Size**: M
- **Dependencies**: feat-party-mode-optim (已完成)
- **Parent**: feat-bmad-workshop
- **Children**: []
- **Created**: 2026-05-29

## Description

PM Workshop（Brainstorm / Party Mode / PRD）三个 Tab 存在严重的会话管理问题：

1. **Tab 切换丢失状态**: `PMWorkshopView.tsx` 使用条件渲染（`{activeTab === 'brainstorm' && <BrainstormPanel />}`），切换 tab 时组件完全卸载，`useAgentStream` 的 session、messages、connectionState、chunk listener 全部丢失。切回后只能从 localStorage 恢复消息，但 session 已断开，`connectionState` 回到 `disconnected`，显示欢迎页。
2. **对话无法清除**: 三个 Panel 都没有暴露 `newSession()` 或 `clearChat()` 的 UI 按钮，用户无法清除旧的对话记录重新开始。
3. **工具调用文本污染**: SDK 的 `tool_use` / `tool_result` 文本可能以原始字符串形式混入 assistant message content，而非作为独立的 `isToolCall` 消息。需要在渲染层过滤掉这些文本，只显示有意义的 MD 内容。

## User Value Points

### VP1: Tab 切换保持会话状态
用户在三个 Tab 之间自由切换时，每个 Tab 的对话、session 连接、流式输出状态完整保持，不丢失不重连。

### VP2: 对话记录清除
用户可以在任意 Tab 中点击"新建会话"按钮，清除当前对话记录、断开旧 session、重新开始。

### VP3: 工具调用渲染优化
对话区域只展示有意义的 Markdown 内容，工具调用的原始字符串被隐藏或折叠为简洁的状态指示器。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/PMWorkshopView.tsx` — Tab 容器，条件渲染（根因）
- `neuro-syntax-ide/src/components/pm-workshop/BrainstormPanel.tsx` — Brainstorm Panel
- `neuro-syntax-ide/src/components/pm-workshop/PartyModePanel.tsx` — Party Mode Panel
- `neuro-syntax-ide/src/components/pm-workshop/PrdCreationPanel.tsx` — PRD Panel
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopMessageRenderer.tsx` — 消息渲染路由
- `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatBubble.tsx` — 聊天气泡 + MD 渲染
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式 Hook（session 管理 + chunk listener）

### Root Cause
- **VP1**: `PMWorkshopView.tsx:71-101` 使用 `{activeTab === X && <Panel />}` 条件渲染，切 tab 时组件卸载
- **VP2**: Panel 组件内无"新建会话"按钮，`useAgentStream` 的 `newSession()` 未暴露给 UI
- **VP3**: `useAgentStream.ts:279-288` 对所有 `assistant`/`system`/`raw`/无 type 的 chunk 累积文本，工具调用文本可能混入 content

### Related Features
- feat-bmad-workspace — PM Workshop Tab 基础设施
- feat-bmad-brainstorm — 头脑风暴 Skill
- feat-bmad-party-mode — Party Mode Skill
- feat-bmad-prd — PRD 创建 Skill
- feat-party-mode-optim — Party Mode 引擎优化
- feat-agent-tool-ui — Agent 工具事件 UI 渲染

## Technical Solution

### 修复 1: Tab 切换保持状态（PMWorkshopView.tsx）

将条件渲染改为 CSS 隐藏：
```tsx
// Before:
{activeTab === 'brainstorm' && <BrainstormPanel ... />}
{activeTab === 'party-mode' && <PartyModePanel ... />}
{activeTab === 'prd' && <PrdCreationPanel ... />}

// After:
<BrainstormPanel ... className={activeTab !== 'brainstorm' ? 'hidden' : ''} />
<PartyModePanel ... className={activeTab !== 'party-mode' ? 'hidden' : ''} />
<PrdCreationPanel ... className={activeTab !== 'prd' ? 'hidden' : ''} />
```

组件保持挂载，只是用 `display: none` 隐藏。需要给每个 Panel 组件增加可选的 `className` prop。

### 修复 2: 清除对话 UI

在每个 Panel 的 header bar 中增加"新建会话"按钮，调用 `useAgentStream.newSession()`：
- BrainstormPanel: header 右侧增加刷新按钮
- PartyModePanel: header 右侧增加刷新按钮
- PrdCreationPanel: header 右侧增加刷新按钮

使用 `RotateCcw` icon（lucide-react），点击后调用 `agent.newSession()`，重置所有本地状态（step、ideas 等）。

### 修复 3: 工具调用文本过滤

在 `WorkshopMessageRenderer.tsx` 或 `WorkshopChatBubble.tsx` 中，对 assistant message content 进行清理：
- 过滤掉 `<tool_use>` / `<tool_result>` XML 标签内容
- 过滤掉 `tool_name: summary` 格式的工具调用文本行
- 保留纯 Markdown 文本供 MarkdownRenderer 渲染

方案: 在 `WorkshopChatBubble.tsx` 中对 `msg.content` 做预处理，去除工具调用相关文本后再传给 MarkdownRenderer。

## Acceptance Criteria (Gherkin)

### User Story
作为 PM Workshop 用户，我希望在三个 Tab 之间自由切换时对话不丢失，能清除旧对话重新开始，且对话界面只显示有意义的 Markdown 内容。

### Scenarios (Given/When/Then)

#### Scenario 1: Tab 切换保持对话
- Given 用户在 Brainstorm Tab 中开始了会话并发送了消息
- When 用户切换到 Party Mode Tab 再切回 Brainstorm Tab
- Then 之前的对话消息完整保持
- And session 连接状态保持 connected
- And 用户可以继续发送消息

#### Scenario 2: 新建会话
- Given 用户在任一 Tab 中有对话记录
- When 用户点击"新建会话"按钮
- Then 对话记录被清除
- And session 被重置为 disconnected
- And 显示欢迎页面
- And localStorage 中的旧消息被清除

#### Scenario 3: 工具调用不显示原始文本
- Given SDK 返回的 assistant 消息中包含工具调用相关文本
- When 消息被渲染到聊天界面
- Then 工具调用的原始字符串被隐藏
- And 只显示有意义的 Markdown 内容

#### Scenario 4: 流式输出期间切换 Tab
- Given 用户在 Brainstorm Tab 中发送了消息正在接收流式响应
- When 用户切换到 Party Mode Tab
- Then Brainstorm 的流式输出在后台继续接收
- When 用户切回 Brainstorm Tab
- Then 完整的响应已经显示

### UI/Interaction Checkpoints
- 每个 Tab header 右侧有"新建会话"按钮（RotateCcw icon）
- Tab 切换时无加载闪烁
- 流式输出光标（pulse animation）在切回后正确显示/隐藏

### General Checklist
- 不引入新的 React Router
- 使用 cn() 合并样式
- 使用 lucide-react 图标
- 保持 useAgentStream hook 的 API 不变
