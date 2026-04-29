# Feature: feat-modal-session-store Modal 会话持久化层

## Basic Information
- **ID**: feat-modal-session-store
- **Name**: Modal 会话持久化层（SessionStore）
- **Priority**: 85
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: [feat-modal-safe-close]
- **Created**: 2026-04-27

## Description
在 App 层面引入 SessionStore（React Context），将 Task Board 弹窗中的对话状态持久化到内存。弹窗关闭时自动保存，重新打开时自动恢复，解决误关闭导致对话历史和 AI 交互状态丢失的问题。

### 背景问题
当前 TaskBoard 的 Feature Detail Modal 和 NewTaskModal 中，所有对话状态（Agent 对话历史、流式输出、执行状态等）都存储在组件级 `useState` 中。弹窗通过 `AnimatePresence` 卸载后状态全部销毁，用户与 AI 的多轮对话无法恢复。

### Scope 定义
**IN（本 Feature 范围内）**:
- Feature Detail Modal Agent tab 对话状态跨关闭/重开恢复
- NewTask Modal PM Agent / External Runtime 对话状态跨关闭/重开恢复
- Feature 级 session 隔离（Map keyed by featureId）
- Feature 完成时自动清理 session
- "Resumed session" UI 指示器（3 秒自动消失 + 可手动 dismiss）
- Session 容量管理（上限 + 截断策略）

**OUT（本 Feature 不做）**:
- App 重启后 session 恢复（纯内存，重启即清空）
- 浏览器刷新 / Tauri WebView 重载后 session 恢复
- 流式输出进行中的中间状态保存（仅保存已完成的状态快照）
- 滚动位置 / 选中文本等 UI 微状态
- 跨设备 / 跨窗口 session 同步

## User Value Points
1. **Task Session 恢复** — 关闭 Feature Detail Modal 后再次打开同一 Feature，Agent tab 的对话输出、操作类型、错误信息等状态完整恢复
2. **NewTask Session 恢复** — 关闭 NewTaskModal 后再次打开，PM Agent / 外部 Runtime 的对话历史和当前步骤恢复

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — Feature Detail Modal 状态管理（closeModal 重置所有状态）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — NewTask 弹窗状态（handleClose 清空对话）
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent 对话 hook（messages, clearChat）
- `neuro-syntax-ide/src/lib/useQueueData.ts` — Queue 数据层

### Related Documents
- Feature Detail Modal Agent tab: feat-agent-conversation
- NewTask Modal chat: feat-chat-style-newtask, feat-newtask-built-in-pm, feat-newtask-runtime-multiturn

### Related Features
- feat-modal-safe-close（依赖本 Feature 的 SessionStore 来保存关闭状态）

## Technical Solution

### 架构：React Context + useRef
使用 App 级 React Context 提供 SessionStore，不引入外部状态管理库。数据存内存（非文件系统），App 生命周期内有效。

### SessionStore 数据结构
```typescript
interface TaskSessionState {
  featureId: string;
  agentOutput: string;        // 截断上限 40KB，超出保留最新内容
  agentAction: AgentActionType;
  agentDone: boolean;
  agentError: string | null;
  lastActiveTab: 'spec' | 'tasks' | 'checklist' | 'agent';
  savedAt: number;             // timestamp, 用于过期检测
}

interface NewTaskSessionState {
  step: ModalStep;
  selectedAgentId: string | null;
  pmMessages: ChatMessage[];   // 上限 200 条，超出截断最早的消息
  extMessages: ExtChatMessage[]; // 上限 200 条
  chatInput: string;
  extChatInput: string;
  savedAt: number;
}

interface SessionStoreState {
  taskSessions: Map<string, TaskSessionState>; // 上限 20 个 feature session
  newTaskSession: NewTaskSessionState | null;  // 单例
}
```

### 容量管理策略
- **taskSessions 上限**: 20 个 feature session，超出时 FIFO 淘汰（按 savedAt 最旧的先清）
- **agentOutput 截断**: 保存时若超过 40KB，保留最新 40KB 内容，头部添加 `…[truncated]` 标记
- **pmMessages / extMessages 截断**: 保存时若超过 200 条，保留最近 200 条
- **Session 过期**: load 时检测 savedAt，超过 24 小时的 session 视为过期，静默清除并返回 null

### API 设计
```typescript
// SessionStoreContext
interface SessionStoreAPI {
  // Task session
  saveTaskSession: (state: TaskSessionState) => void;
  loadTaskSession: (featureId: string) => TaskSessionState | null;
  clearTaskSession: (featureId: string) => void;

  // NewTask session
  saveNewTaskSession: (state: NewTaskSessionState) => void;
  loadNewTaskSession: () => NewTaskSessionState | null;
  clearNewTaskSession: () => void;
}
```

### 改动点
1. 新建 `src/lib/SessionStore.tsx` — Context + Provider（接口类型定义放在 `types.ts`）
2. 修改 `App.tsx` — 包裹 SessionStoreProvider
3. 修改 `TaskBoard.tsx` — closeModal 时 saveTaskSession，handleFeatureClick 时 loadTaskSession
4. 修改 `NewTaskModal.tsx` — handleClose 时 saveNewTaskSession，open 时 loadNewTaskSession
5. 修改 `useQueueData.ts` 或 `TaskBoard.tsx` — feature 状态变更到 completed 时调用 clearTaskSession
6. 添加 "resumed session" UI 指示器

## Acceptance Criteria (Gherkin)
### User Story
As a developer using the Task Board to interact with AI agents, I want my conversation history and interaction state to persist across modal open/close cycles, so that I don't lose my work when I accidentally close a modal.

### Scenarios

#### Scenario: Restore Feature Detail Agent state after close
```gherkin
Given a Feature Detail Modal is open with Agent tab active
And the AI has generated streaming output "Review complete..."
When the user clicks the backdrop or Close button
And the user clicks the same feature card again
Then the modal opens with Agent tab active
And the streaming output "Review complete..." is restored
And a subtle "Resumed session" indicator is shown
```

#### Scenario: Restore NewTask PM Agent conversation
```gherkin
Given the NewTaskModal is open on step "input-requirement"
And PM Agent has 3 messages of conversation history
When the user accidentally closes the modal
And the user clicks "New Task" again
Then the modal opens on step "input-requirement"
And the PM Agent conversation with 3 messages is restored
And the selected agent (PM Agent) is pre-selected
```

#### Scenario: Independent sessions per feature
```gherkin
Given the user opened Feature A and ran an Agent review
And the user opened Feature B and ran a different Agent action
When the user reopens Feature A
Then Feature A's review output is shown (not Feature B's)
```

#### Scenario: Clear session on feature completion
```gherkin
Given a task session exists for Feature X
When Feature X is moved to "completed" queue
Then the session for Feature X is automatically cleared
```

#### Scenario: Session data is stale or corrupted
```gherkin
Given a task session exists for Feature X with corrupted data
When the user opens Feature X's Detail Modal
Then the modal opens with default empty state (no crash)
And the corrupted session is silently cleared
And no "Resumed session" indicator is shown
```

#### Scenario: Session exceeds size limit
```gherkin
Given the user ran an Agent review that generated 60KB of output
When the user closes the Feature Detail Modal
Then the session is saved with agentOutput truncated to 40KB
And the oldest content is replaced with a truncation marker
```

#### Scenario: Session expires after 24 hours
```gherkin
Given a task session exists for Feature X saved more than 24 hours ago
When the user opens Feature X's Detail Modal
Then the session is treated as expired and silently cleared
And the modal opens with default empty state
```

#### Scenario: FIFO eviction when session count exceeds limit
```gherkin
Given task sessions exist for 20 features
When the user opens a 21st feature and closes its modal
Then the oldest session (by savedAt) is evicted
And the new session is saved successfully
```

### UI/Interaction Checkpoints
- "Resumed session" 标记：Agent tab 上方小标签，点击可 dismiss，3 秒后自动消失
- 无 session 时行为不变（不显示任何提示）

### General Checklist
- Session 数据不写入文件系统（纯内存）
- Feature 间 session 互不干扰
- SessionStore 不影响现有 fs://workspace-changed 刷新逻辑
- 内存占用可控（单个 session < 50KB，总量 < 1MB）
- Session 过期（24h）和容量上限（20 个 task session）有自动清理机制
- agentOutput 截断不影响用户可读性（保留最新内容）
- 接口类型定义集中在 `types.ts`，SessionStore.tsx 做 import

## Merge Record
- **Completed**: 2026-04-28
- **Merged Branch**: feature/modal-session-store
- **Merge Commit**: b0e1787
- **Archive Tag**: feat-modal-session-store-20260428
- **Conflicts**: none
- **Verification**: passed (8/8 Gherkin scenarios, 0 new TypeScript errors)
- **Stats**: 1 commit, 5 files changed, 379 insertions, 14 deletions
