# Feature: feat-dispatch-runtime-graceful Fix dispatch_to_runtime Command Not Found

## Basic Information
- **ID**: feat-dispatch-runtime-graceful
- **Name**: Fix dispatch_to_runtime Command Not Found
- **Priority**: 80
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06T12:00:00Z

## Merge Record
- **Completed**: 2026-04-07T09:47:00Z
- **Merged Branch**: feature/feat-dispatch-runtime-graceful
- **Merge Commit**: 95a9ef0
- **Archive Tag**: feat-dispatch-runtime-graceful-20260407
- **Conflicts**: none
- **Verification**: passed (4/4 Gherkin scenarios, 7/7 tasks)
- **Evidence**: evidence/verification-report.md
- **Stats**: 2 commits, 3 files changed (utils.ts, NewTaskModal.tsx, TaskBoard.tsx)

## Description
当用户在 NewTaskModal 中选择 Claude Code CLI 或 Codex 等外部 runtime agent 并执行时，Tauri `invoke('dispatch_to_runtime')` 因后端 Rust 命令未实现而抛出 "Command dispatch_to_runtime not found" 错误。

需要在前端层面优雅降级：当 Tauri 后端尚未实现 `dispatch_to_runtime` 命令时，前端不应直接崩溃，而应给出明确提示或回退到可用的执行路径。

## User Value Points
1. **运行时可用性检测** — 外部 runtime（Claude Code CLI / Codex）状态为 "available" 但 Tauri 后端命令未就绪时，用户应看到清晰的不可用提示而非报错
2. **优雅降级执行** — dispatch_to_runtime 不可用时，回退到 PM Agent（内置 agent）执行路径，确保用户仍能完成 feature 创建

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — handleExecute 中 `invoke('dispatch_to_runtime')` 调用（line 310）
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — agent 对话 dispatch 调用（line 490, 496）
- `features/archive/done-feat-new-task-agent-dispatch-20260405/` — 原 dispatch 功能的 feature 归档

### Related Documents
- project-context.md — Phase 1 阶段尚未创建 src-tauri/ 后端

### Related Features
- feat-new-task-agent-dispatch（已归档）— 原始 dispatch 功能实现

## Technical Solution

### 方案：前端 try-catch + 命令可用性检测

1. **`isCommandAvailable()` 工具函数** — 通过 try-catch `invoke('__TAURI_INTERNALS__')` 或直接 try `invoke('dispatch_to_runtime', {...})` 检测命令是否存在，返回 boolean

2. **NewTaskModal handleExecute 改造** — 在 `invoke('dispatch_to_runtime')` 的 catch 中，如果错误包含 "not found"，则：
   - 显示友好提示："外部 runtime 暂不可用，正在回退到 PM Agent..."
   - 自动回退到内置 PM Agent 路径执行

3. **TaskBoard agent 对话改造** — 同样的 catch + 降级逻辑

4. **Agent 选择 UI 改造** — 检测 Tauri 命令是否可用，不可用时将外部 agent 标记为 disabled 或显示提示

### 不涉及
- 不实现 Rust 后端 `dispatch_to_runtime` 命令（属于 Phase 2 范畴）
- 不修改 runtime 检测逻辑（`useRuntimeDetection` hook）

## Acceptance Criteria (Gherkin)
### User Story
作为一个 IDE 用户，我希望在选择 Claude Code CLI 作为 agent 执行 feature 创建时，如果后端命令未就绪，能看到清晰的提示并自动回退到内置 agent，而不是看到一个难以理解的错误。

### Scenarios (Given/When/Then)

#### Scenario 1: Tauri 命令不可用时优雅降级
```gherkin
Given 用户已打开 NewTaskModal
And 已选择 Claude Code CLI 作为 agent
And Tauri 后端未实现 dispatch_to_runtime 命令
When 用户输入需求并点击 Execute
Then 系统显示友好提示 "外部 runtime 暂不可用，回退到 PM Agent"
And 系统使用 PM Agent 路径执行 feature 创建
And feature 创建成功
```

#### Scenario 2: Agent 选项显示不可用状态
```gherkin
Given Tauri 后端未实现 dispatch_to_runtime 命令
When 用户查看 agent 选择列表
Then 外部 runtime agents (Claude Code CLI, Codex) 显示为 disabled 或带提示标签
And PM Agent 保持可选状态
```

#### Scenario 3: Tauri 命令可用时正常执行
```gherkin
Given Tauri 后端已实现 dispatch_to_runtime 命令
And 用户选择 Claude Code CLI 作为 agent
When 用户输入需求并点击 Execute
Then 系统正常通过 dispatch_to_runtime 调用执行
And 不触发降级逻辑
```

#### Scenario 4: TaskBoard agent 对话同样降级
```gherkin
Given 用户在 TaskBoard Feature Detail Modal 中使用 agent 对话
And Tauri 后端未实现 dispatch_to_runtime 命令
When 用户发送 develop/review/modify 指令
Then 系统显示友好提示而非 "Command not found" 错误
```

### UI/Interaction Checkpoints
- NewTaskModal agent 列表中，不可用 agent 显示 disabled 样式 + tooltip 提示
- 执行时降级提示以 streaming output 形式显示（不弹窗）
- TaskBoard agent 对话错误区域显示友好提示

### General Checklist
- [ ] 不影响 PM Agent 正常执行路径
- [ ] 不影响浏览器开发模式 mock 路径
- [ ] 不引入新的外部依赖
