# Feature: feat-agent-conversation Agent Conversation in Feature Detail

## Basic Information
- **ID**: feat-agent-conversation
- **Name**: Feature Detail Modal Agent 对话区（Review/Modify/Develop）
- **Priority**: 55
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06

## Description

在 TaskBoard Feature Detail Modal 中增加 Agent 操作区，支持对未完成的 feature 进行需求 Review、需求 Modify、以及启动 Develop。

核心能力：
1. **Review（需求确认）**— 调用 Claude Code `/new-feature`，注入当前 spec.md 内容，让 AI 审查需求完整性
2. **Modify（修改需求）**— 调用 Claude Code `/new-feature`，注入 spec.md + 用户修改指令，AI 增量修改 feature 的 md 文件
3. **Develop（开始开发）**— 调用 Claude Code `/dev-agent`，传入 feature ID，启动开发流程

仅当 feature 状态不为 `completed` 时显示 Agent 操作区。

## User Value Points

1. **VP1: 需求 Review** — 在开发前让 AI 审查 spec 完整性，提前发现遗漏和矛盾
2. **VP2: 需求迭代 Modify** — 不离开 Detail Modal 即可通过对话修改 feature 的 spec/task/checklist
3. **VP3: 一键启动 Develop** — 确认需求后直接 dispatch `/dev-agent` 开始开发

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` L602-811 — Feature Detail Modal（改造目标）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` L229-276 — External runtime dispatch 模式（复用）
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — Runtime 检测
- `neuro-syntax-ide/src/lib/useQueueData.ts` — readDetail 读取 feature md 文件

### Related Documents
- `.claude/skills/new-feature/` — /new-feature skill 定义
- `.claude/skills/dev-agent/` — /dev-agent skill 定义

### Related Features
- `feat-new-task-agent-dispatch` (已完成) — New Task 弹窗的 Agent 分发模式
- `feat-agent-runtime-system` (已完成) — Agent Runtime 系统基础设施

## Technical Solution

### 整体架构

在 Feature Detail Modal 中新增第 4 个 tab "Agent"，仅未完成 feature 可见。

```
┌─────────────────────────────────────────────────┐
│  Spec | Tasks | Checklist | Agent (未完成可见)    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Agent: Claude Code ▾  (runtime 选择)            │
│                                                 │
│  操作类型:                                       │
│  ● Review (审查需求完整性)                        │
│  ○ Modify (修改需求)                              │
│  ○ Develop (启动开发)                             │
│                                                 │
│  补充说明:                                       │
│  ┌──────────────────────────────────────┐        │
│  │ textarea (用户追加指令)               │        │
│  └──────────────────────────────────────┘        │
│                                                 │
│  [Send to Claude Code]                          │
│                                                 │
│  ── 执行结果 ──                                  │
│  (流式输出区域)                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### dispatch 参数设计

**Review:**
```
dispatch_to_runtime({
  runtimeId: 'claude-code',
  skill: '/new-feature',
  args: {
    prompt: `Review this feature spec for completeness and consistency:\n\n<spec.md content>\n\nUser notes: <user additional input>`
  }
})
```

**Modify:**
```
dispatch_to_runtime({
  runtimeId: 'claude-code',
  skill: '/new-feature',
  args: {
    prompt: `Modify feature ${featureId}:\n\nUser modification: <user input>\n\nCurrent spec:\n<spec.md content>\n\nCurrent tasks:\n<task.md content>`
  }
})
```

**Develop:**
```
dispatch_to_runtime({
  runtimeId: 'claude-code',
  skill: '/dev-agent',
  args: {
    feature: featureId
  }
})
```

### 关键实现点

1. 在 TaskBoard.tsx 的 Feature Detail Modal 中新增 "Agent" tab
2. Agent tab 内容：runtime 选择 + 操作类型 radio + textarea + 发送按钮
3. 点击发送后：
   - 读取当前 feature 的 spec.md / task.md 内容
   - 根据操作类型拼装 prompt
   - dispatch_to_runtime 调用
   - 监听 `runtime_dispatch_chunk` 事件显示流式输出
4. 执行完成后触发 `refresh()` 刷新 queue 数据

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在 Feature Detail Modal 中直接通过 Claude Code 对 feature 进行需求 Review、修改和启动开发，以便无需切换工具即可完成需求迭代。

### Scenarios (Given/When/Then)

**Scenario 1: 需求 Review**
```gherkin
Given 用户打开一个未完成 feature 的 Detail Modal
And 切换到 Agent tab
When 用户选择 "Review" 操作并点击 "Send to Claude Code"
Then 系统读取当前 feature 的 spec.md 内容
And 通过 dispatch_to_runtime 调用 Claude Code /new-feature
And 流式显示 AI 审查结果
```

**Scenario 2: 需求 Modify**
```gherkin
Given 用户打开一个未完成 feature 的 Detail Modal
And 切换到 Agent tab
When 用户选择 "Modify" 操作，输入修改指令 "增加 OAuth2 登录方式"
And 点击 "Send to Claude Code"
Then 系统读取 spec.md + task.md 内容
And 拼装修改 prompt 发送给 Claude Code
And 执行完成后自动刷新 feature 详情
```

**Scenario 3: 启动开发**
```gherkin
Given 用户打开一个未完成 feature 的 Detail Modal
And 切换到 Agent tab
When 用户选择 "Develop" 操作并点击 "Send to Claude Code"
Then 系统调用 dispatch_to_runtime，skill 为 /dev-agent，args 包含 feature ID
And Claude Code 开始执行开发流程
```

**Scenario 4: 已完成 feature 不显示 Agent tab**
```gherkin
Given 用户打开一个已完成 feature 的 Detail Modal
Then Agent tab 不可见
```

**Scenario 5: 无可用 runtime 时的提示**
```gherkin
Given Claude Code runtime 状态为 not-installed
When 用户切换到 Agent tab
Then 显示 runtime 不可用提示和安装指引
```

### UI/Interaction Checkpoints
- Agent tab 仅未完成 feature 可见
- Review/Modify/Develop 三种操作用 radio 切换
- textarea 在 Review 和 Develop 时可选填，Modify 时必填
- 发送按钮在 runtime 不可用时 disabled
- 流式输出区域滚动展示执行进度
- 执行完成后自动刷新 Spec/Tasks/Checklist 内容

### General Checklist
- 复用 NewTaskModal 中已有的 dispatch_to_runtime 模式
- 不引入新的第三方依赖
- Agent tab UI 风格与现有 Spec/Tasks/Checklist tab 一致

## Merge Record
- **Completed**: 2026-04-07
- **Merged Branch**: feature/feat-agent-conversation
- **Merge Commit**: 12b34eb
- **Archive Tag**: feat-agent-conversation-20260407
- **Conflicts**: none
- **Verification**: passed (5/5 scenarios)
- **Stats**: 1 commit, 2 files changed, +277 insertions, -5 deletions
- **Archive Path**: features/archive/done-feat-agent-conversation-20260407
