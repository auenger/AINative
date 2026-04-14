# Feature: feat-newtask-runtime-multiturn New Task 外部 Runtime 多轮对话支持

## Basic Information
- **ID**: feat-newtask-runtime-multiturn
- **Name**: New Task 外部 Runtime 多轮对话支持
- **Priority**: 50
- **Size**: S
- **Dependencies**: [feat-newtask-built-in-pm]
- **Parent**: feat-pm-newtask-role-separation
- **Children**: []
- **Created**: 2026-04-13

## Description

当前 New Task Modal 选择 Claude Code 等外部 Runtime 时，只提供一个 textarea 单次输入，直接发送 `/new-feature {text}`。

**简化方案**：外部 Runtime 路径模仿内置 PM Agent 的 chat 设计（类似 REQ Agent），在点击 "Create Feature" 之前支持多轮对话来丰富和对齐上下文。

核心思路：
1. 外部 Runtime 路径的 textarea → chat panel（复用内置 PM 的消息气泡样式）
2. 每轮用户消息通过 `runtime_execute` 发送给外部 Runtime，回复流式显示
3. 用户觉得上下文够了，点击 "Create Feature" → 将对话上下文组装发送 `/new-feature`
4. 监听 `fs://workspace-changed` 捕获 feature 创建结果

不需要额外的 hook 或复杂状态管理，直接在 NewTaskModal 中用简单的 messages 数组 + runtime_execute 循环即可。

## User Value Points

### VP1: 多轮对话丰富上下文
- 选择 Claude Code 后也能逐步描述需求，不用一次写完
- 类似 REQ Agent 的体验：先聊清楚，再触发正式创建

### VP2: 统一的 New Task 体验
- 无论内置 PM 还是外部 Runtime，都是 chat → Create Feature 流程
- 交互模式一致，降低认知负担

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — 外部 Runtime textarea 路径 (L754-777)，内置 PM chat panel (L644-751)
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent chat hook 参考（messages 数组 + streaming 模式）

### Related Features
- feat-newtask-built-in-pm — 前置依赖
- feat-chat-style-newtask — 已完成的内置 PM chat 界面（直接复用其消息气泡样式）

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望在 New Task 中选择 Claude Code 时也能先多轮对话讨论需求，聊清楚后再点击创建 Feature。

### Scenarios (Given/When/Then)

#### Scenario 1: Chat Panel 替代 Textarea
```gherkin
Given 用户在 New Task Modal 中选择 Claude Code
When 进入需求输入步骤
Then 显示与内置 PM 一样的 chat panel（消息气泡 + 输入框）
And 用户可以发送多条消息
And Claude Code 的回复流式显示在气泡中
```

#### Scenario 2: 对话后触发 /new-feature
```gherkin
Given 用户与 Claude Code 完成了多轮需求对话
When 用户点击 "Create Feature"
Then 将完整对话上下文组装为 /new-feature 命令
And 通过 runtime_execute 发送
And 通过 fs://workspace-changed 捕获创建结果
```

#### Scenario 3: 与内置 PM 统一的交互流程
```gherkin
Given New Task Modal 中无论选择哪个 Agent
When 进入需求输入步骤
Then 都显示 chat panel + "Create Feature" 按钮
And 只有内置 PM 和外部 Runtime 的后端调用方式不同，前端体验一致
```

### UI/Interaction Checkpoints
- 外部 Runtime：textarea 消失，改为与内置 PM 相同的 chat panel
- "Create Feature" 按钮在至少 1 条用户消息后可用
- 消息气泡样式复用内置 PM 的设计

### General Checklist
- [ ] 外部 Runtime 路径 chat panel 替换 textarea
- [ ] 多轮 runtime_execute 循环工作正常
- [ ] /new-feature 触发逻辑正确
- [ ] fs://workspace-changed 事件监听正确
