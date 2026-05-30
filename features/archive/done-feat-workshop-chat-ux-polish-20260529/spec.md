# Feature: feat-workshop-chat-ux-polish PM Workshop 对话渲染优化

## Basic Information

* **ID**: feat-workshop-chat-ux-polish

* **Name**: PM Workshop 对话渲染优化（OPTIONS 描述 + INIT 隐藏 + Tool Call 简化 + Party Mode 面板）

* **Priority**: 70

* **Size**: M

* **Dependencies**: feat-bmad-workshop (已完成)

* **Parent**: feat-bmad-workshop

* **Children**: []

* **Created**: 2026-05-29T23:00:00Z

## Description

优化 PM Workshop 所有对话中的渲染体验，包括 Brainstorm、Party Mode、PRD 三个子面板：

1. **OPTIONS 按钮显示优化**：当 Agent 返回 OPTIONS 列表时，按钮上显示 DESCRIPTION（人类可读描述）而非 ID（如 HOBBY/INTERNAL/STARTUP），让用户更直观地理解选项含义

2. **INIT 系统消息隐藏**：隐藏 `[SYSTEM] INIT — 42 TOOLS AVAILABLE, MODEL: claude-opus-4-7[1m]` 类系统初始化信息，改为简洁的 loading/thinking 状态指示器

3. **Tool Call 噪音过滤**：隐藏 `[tool: Agent] {"description":"...","prompt":"..."}` 等原始工具调用 JSON 输出，替换为简洁的 "working" 状态指示

4. **Party Mode 面板重构**：选择完角色后隐藏 Recommended Panelists 区，每个角色用独立 Tab/Pannel 展示分析结果，方便对比查看

优化 1/2/3 适用于产品工坊中每个对话（Brainstorm / Party Mode / PRD），优化 4 针对 Party Mode。

## User Value Points

### VP1: 选项可读性提升

OPTIONS 按钮从显示 ID（如 "HOBBY"）改为显示 DESCRIPTION（如 "个人项目/副业，最低限度的文档规范"），用户无需猜测含义即可快速选择。

### VP2: 对话噪音消除

消除 INIT 系统信息和原始 Tool Call JSON 输出两类视觉噪音，用简洁的 loading/working 状态替代，让用户聚焦于对话内容本身。

### VP3: Party Mode 多角色结果对比

选择完 Panelists 后，Recommended Panelists 消失，每个角色获得独立面板展示分析内容，用户可以并排或切换查看不同角色的观点。

## Context Analysis

### Reference Code

* `neuro-syntax-ide/src/lib/useAgentStream.ts` — Stream 事件处理、ChatMessage 类型定义

* `neuro-syntax-ide/src/components/pm-workshop/WorkshopMessageRenderer.tsx` — 消息路由/分发

* `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatBubble.tsx` — 聊天气泡渲染、filterToolCallText

* `neuro-syntax-ide/src/components/pm-workshop/OptionCardMessage.tsx` — OPTIONS 按钮卡片

* `neuro-syntax-ide/src/components/pm-workshop/PartyModePanel.tsx` — Party Mode 面板

* `neuro-syntax-ide/src/components/pm-workshop/WorkshopChatPanel.tsx` — 聊天面板布局

* `neuro-syntax-ide/src/components/pm-workshop/PersonaCardMessage.tsx` — 角色卡片消息

### Related Documents

* CLAUDE.md — Agent Runtime 架构、Workshop 消息格式

* project-context.md — PM Workshop 视图描述

### Related Features

* feat-bmad-workshop (已完成) — BMAD Workshop 基础设施

* feat-bmad-brainstorm (已完成) — Brainstorm 面板

* feat-bmad-party-mode (已完成) — Party Mode 面板

* feat-party-mode-optim (已完成) — Party Mode 引擎优化

* fix-workshop-session-state (已完成) — 会话状态修复 + 工具调用渲染

## Technical Solution

### 优化 1: OPTIONS 按钮显示 DESCRIPTION

**当前行为**: Agent 返回的 OPTIONS 列表通过 `<!-- workshop:option-card -->` 标记解析，每个选项有 `id`、`title`、`description`。当前 OptionCardMessage 组件已显示 title + description，但问题在于：

* 当 Agent 使用 `[SYSTEM]` 格式返回 OPTIONS（非 HTML comment 标记），如 `"OPTIONS": [{"ID": "HOBBY", "LABEL": "HOBBY", "DESCRIPTION": "..."}]`，这些会作为普通文本显示

* 需要增加对 `[SYSTEM]` + `OPTIONS` JSON 格式的解析

**方案**: 在 `WorkshopChatBubble.tsx` 的 `filterToolCallText` 函数中增加 OPTIONS JSON 模式匹配，解析并渲染为 OptionCardMessage 组件。同时增强 `parseWorkshopMarkers` 支持 `[SYSTEM]` OPTIONS 格式。

**关键文件**: `WorkshopChatBubble.tsx`, `BrainstormPanel.tsx` (parseWorkshopMarkers)

### 优化 2: INIT 消息隐藏

**当前行为**: INIT 消息（如 `[SYSTEM]INIT — 49 TOOLS AVAILABLE, MODEL: claude-opus-4-7[1M]`）作为 `system` 或 `raw` 类型的 chunk 到达，被追加为 assistant 消息并渲染为普通 Markdown。

**方案**:

1. 在 `useAgentStream.ts` 的 chunk 处理中检测 INIT 模式（`/^\[SYSTEM\]\s*INIT/i` 或 `/^\s*INIT\s*—/i`）

2. 不将其作为消息内容追加，而是设置一个 `agentStatus` 状态（如 'thinking' | 'loading'）

3. 在 `WorkshopChatBubble` 中，当最后一条消息正在 streaming 且 agentStatus 为 thinking 时，显示 "Thinking..." 脉冲指示器而非原始文本

**关键文件**: `useAgentStream.ts`, `WorkshopMessageRenderer.tsx`, `WorkshopChatBubble.tsx`

### 优化 3: Tool Call 简化

**当前行为**: Tool call 通过 `tool_use` 类型 chunk 创建独立的 `isToolCall: true` 消息，由 `ToolCallMessage` 组件渲染为黄色/绿色/红色状态行。同时工具调用的原始 JSON 文本可能混入 assistant 消息内容。

**方案**:

1. 增强 `filterToolCallText` 过滤更多 tool call 噪音模式：

   * `[tool: xxx] {json}` 格式

   * `task_started` / `task_progress` / `task_notification` 标记

   * `tool_name: xxx` / `tool_result: xxx` 行

2. 在 `ToolCallMessage` 中简化显示：running 状态只显示 spinner + "Working..."，不显示 tool name 的原始 JSON

**关键文件**: `WorkshopChatBubble.tsx`, `WorkshopMessageRenderer.tsx`

### 优化 4: Party Mode 面板重构

**当前行为**: Recommended Panelists 确认后仍然显示在聊天区上方。角色响应在右侧固定 `w-80` 面板中垂直堆叠。

**方案**:

1. `handleRosterConfirm` 后立即清除 `pendingRoster`（已实现）

2. 将右侧面板改为 Tab 式布局：每个角色一个 Tab，点击切换查看

3. Tab 标签显示角色 emoji + 名称，当前活跃角色高亮

4. 保留 "All" Tab 显示所有角色响应（当前垂直堆叠行为）

**关键文件**: `PartyModePanel.tsx`, `WorkshopChatPanel.tsx`

## Acceptance Criteria (Gherkin)

### User Story

作为一个 PM Workshop 用户，我希望对话界面清晰、无噪音，选项直观可读，多角色分析结果方便对比。

### Scenarios (Given/When/Then)

#### Scenario 1: OPTIONS 按钮显示描述

```gherkin
Given 用户在 Brainstorm/Party Mode/PRD 面板中与 Agent 对话
When Agent 返回包含 OPTIONS 列表的消息
Then 每个选项按钮应显示 DESCRIPTION 文本作为主标签
And 不应显示原始 ID 文本
And 点击按钮时发送对应的 ID 作为用户选择
```

#### Scenario 2: INIT 消息不显示

```gherkin
Given 用户在 PM Workshop 中开始对话
When Agent 返回 INIT 类系统消息（如 "INIT — 42 TOOLS AVAILABLE, MODEL: xxx"）
Then 该消息不应作为聊天气泡显示
And 应显示简洁的 "Thinking..." 或 loading 状态指示器
And 当 Agent 开始返回实际内容时，loading 状态消失
```

#### Scenario 3: Tool Call 噪音过滤

```gherkin
Given 用户在 PM Workshop 中与 Agent 对话
When Agent 执行工具调用并产生 [tool: Agent] JSON 输出
Then 原始 JSON 文本不应出现在聊天气泡中
And 应显示简洁的 "Working..." spinner 状态
And 工具完成后状态变为简洁的 success 指示
And task_started / task_progress / task_notification 等标记不应显示
```

#### Scenario 4: Party Mode 角色选择后隐藏推荐列表

```gherkin
Given 用户在 Party Mode 中且 Agent 已推荐角色列表
When 用户点击 "Confirm & Start" 确认角色选择
Then Recommended Panelists 区域应完全消失
And 对话区恢复全宽显示
```

#### Scenario 5: Party Mode 独立角色面板

```gherkin
Given Party Mode 已完成至少一轮角色响应
When 用户查看角色分析结果
Then 每个角色应显示为独立的 Tab
And 点击角色 Tab 切换查看该角色的分析内容
And 有一个 "All" Tab 显示所有角色响应
And Tab 标签显示角色 emoji 和名称
```

### UI/Interaction Checkpoints

* [ ] OPTIONS 按钮：emoji + DESCRIPTION 为主文本，ID 作为次文本或隐藏
* [ ] INIT 消息：仅显示为闪烁的 "Thinking..." 指示器
* [ ] Tool Call：仅显示为 "Working..." spinner + 简洁完成指示
* [ ] Party Mode Tab：水平 Tab 栏，角色 emoji + 名称，活跃 Tab 高亮
* [ ] 滚动行为：切换 Tab 时不影响聊天区滚动位置

### General Checklist

* [ ] 优化适用于所有三个 Workshop 子面板（Brainstorm / Party Mode / PRD）
* [ ] 不影响 Agent 的实际功能（仅改变显示层）
* [ ] filterToolCallText 不误过滤正常的 markdown 内容

⠀