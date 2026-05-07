# Feature: feat-agent-tool-ui Agent 工具事件 UI 渲染

## Basic Information
- **ID**: feat-agent-tool-ui
- **Name**: Agent 工具事件 UI 渲染
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-agent-tool-exec
- **Parent**: feat-agent-tool-loop
- **Children**: []
- **Created**: 2026-05-06
- **Completed**: 2026-05-06
- **Merge Record**:
  - merged_branch: feature/feat-agent-tool-ui
  - merge_commit: 59ac7ec
  - archive_tag: feat-agent-tool-ui-20260506
  - conflicts: none
  - verification: passed (3/3 Gherkin scenarios, code analysis)
  - files_changed: 2 (useAgentStream.ts, ProjectView.tsx)
  - duration: ~30m

## Description

前端 `useAgentStream.ts` 需要处理和渲染后端发出的 `tool_use` 和 `tool_result` 类型的 StreamEvent。当前 chunk listener 只处理 `assistant`、`system`、`raw` 类型的文本事件，工具事件被忽略。

需要添加工具事件的 UI 展示：显示正在执行的工具名称、参数摘要、执行结果，让用户了解 agent 正在做什么。

## User Value Points

### VP1: 工具执行可见性
用户能实时看到 PM Agent 正在执行什么操作（如 "正在写入 project-context.md..."），而不是只看到 XML 文本。

### VP2: 执行结果反馈
用户能知道工具是否执行成功，失败时有明确的错误提示。

## Context Analysis

### Reference Code
- `src/lib/useAgentStream.ts` — chunk listener (line ~200-290)，需要扩展事件类型处理
- `src/components/RuntimeOutputModal.tsx` — 已有 `tool_use`/`tool_result` 渲染逻辑 (line ~173-192)
- `src/components/views/ProjectView.tsx` — PM Agent 聊天面板

### Related Features
- feat-agent-tool-exec (前置依赖，发出 tool_use/tool_result 事件)

## Technical Solution

### 1. useAgentStream.ts 事件处理扩展

在 chunk listener 中添加：
```typescript
// 工具调用事件
if (chunk.type === 'tool_use') {
  // 添加工具调用状态消息到聊天
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `🔧 ${chunk.tool_name}(${chunk.tool_input_summary})`,
    isToolCall: true
  }]);
}

// 工具结果事件
if (chunk.type === 'tool_result') {
  // 更新工具调用消息的状态
  setMessages(prev => updateToolResult(prev, chunk));
}
```

### 2. 聊天消息类型扩展

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isToolCall?: boolean;
  toolName?: string;
  toolStatus?: 'running' | 'success' | 'error';
  toolResult?: string;
}
```

### 3. UI 渲染

工具调用消息使用特殊样式：
- Running: 黄色背景 + 旋转图标
- Success: 绿色背景 + ✓
- Error: 红色背景 + ✗

## Acceptance Criteria (Gherkin)

### Scenario 1: 工具调用显示
```gherkin
Given PM Agent 正在执行工具调用
When 前端收到 tool_use 类型的 StreamEvent
Then 聊天界面显示工具调用状态（如 "写入 project-context.md"）
And 状态带有视觉指示（loading 动画或图标）
```

### Scenario 2: 工具结果显示
```gherkin
Given 工具调用已完成
When 前端收到 tool_result 类型的 StreamEvent
Then 工具状态更新为完成（成功/失败）
And 成功时显示简短结果摘要
And 失败时显示错误信息
```

### Scenario 3: 不影响正常文本流
```gherkin
Given PM Agent 返回纯文本响应（无工具调用）
When 前端收到 assistant 类型的 StreamEvent
Then 聊天界面正常流式显示文本
And 不出现任何工具状态 UI
```

### General Checklist
- [ ] tool_use/tool_result 事件正确处理
- [ ] 工具状态 UI 清晰可辨
- [ ] 正常文本流不受影响
