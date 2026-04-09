# Feature: feat-runtime-session-output Claude Code Runtime Session 输出持久化与监控

## Basic Information
- **ID**: feat-runtime-session-output
- **Name**: Claude Code Runtime Session 输出持久化与监控
- **Priority**: 70
- **Size**: M
- **Dependencies**: feat-claude-code-runtime-monitor (completed)
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-08T18:00:00Z

## Description

用户在 TaskBoard 创建任务后选择 Claude Code Runtime 执行，关闭弹窗后无法再看到执行进度和输出。
根本原因：`closeModal()` 清空所有 agent 状态（agentOutput, agentDone 等），而后端进程仍在运行但前端已无法接收输出。

需要：
1. 后端添加 session 输出缓冲区，runtime_execute 的 chunk 事件持久化存储到 HashMap<SessionId, Vec<StreamEvent>>
2. 新增 `get_active_session` 命令获取当前活跃 session 的缓冲输出文本
3. 新增 `clear_session_output` 命令清理 session buffer
4. StatusBar runtime 指示器添加 "View Output" 入口，有活跃 session 时显示
5. RuntimeOutputModal 组件：加载已缓冲输出 + 实时接收新 chunk + 自动滚动 + 完成标记

## User Value Points

### VP1: Session 输出持久化（后端）
- Claude Code 执行的所有 chunk 事件在后端按 session 缓冲
- 即使前端弹窗关闭，输出不会丢失
- 新增 `get_active_session` 返回完整缓冲文本 + 状态

### VP2: StatusBar 输出查看器（前端）
- StatusBar runtime popover 中 Claude Code 运行时显示 "View Output" 按钮
- 点击打开 RuntimeOutputModal 查看完整执行过程
- 弹窗加载时先回放已有输出，再实时接收新 chunk

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:2091` — AppState struct
- `neuro-syntax-ide/src-tauri/src/lib.rs:4980` — runtime_execute 函数（spawned thread）
- `neuro-syntax-ide/src-tauri/src/lib.rs:5036` — runtime_session_start 函数
- `neuro-syntax-ide/src-tauri/src/lib.rs:536` — StreamEvent struct
- `neuro-syntax-ide/src/components/StatusBar.tsx` — StatusBar runtime popover
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:351` — closeModal 重置 agent 状态
- `neuro-syntax-ide/src/types.ts` — 类型定义集中

### Related Documents
- `/Users/ryan/.claude/plans/purrfect-sauteeing-flute.md` — 详细实现方案

### Related Features
- feat-claude-code-runtime-monitor (completed) — 提供 runtime 进程监控基础
- feat-agent-conversation (completed) — TaskBoard Agent 对话区
- feat-new-task-runtime-execute (completed) — Runtime 执行能力

## Technical Solution

### 后端 (lib.rs)

#### 1. AppState 新增字段
```rust
/// Session output buffer: session_id -> Vec<StreamEvent>
session_output: Arc<Mutex<HashMap<String, Vec<StreamEvent>>>>,
/// Currently active session id
active_session_id: Mutex<Option<String>>,
```

#### 2. 修改 runtime_session_start
生成 session_id 后写入 `active_session_id`。

#### 3. 修改 runtime_execute spawned thread
emit 事件同时写入 session_output buffer。需要 Arc clone 传入线程。

#### 4. 新增命令
- `get_active_session` -> Option<ActiveSessionInfo>（session_id, output_text, is_done, chunk_count）
- `clear_session_output` -> 清理 buffer 和 active_session_id

### 前端

#### 1. types.ts
新增 `ActiveSessionInfo` 接口。

#### 2. RuntimeOutputModal.tsx（新组件）
- 可拖拽弹窗，复用现有 modal 模式
- 加载时 invoke('get_active_session') 获取缓冲输出
- listen('agent://chunk') 实时接收新输出
- 自动滚动到底部
- 完成标记 + Clear 按钮

#### 3. StatusBar.tsx
- 轮询 get_active_session 状态（3s interval）
- 有活跃 session 时在 Claude Code card 显示 "View Output" 按钮
- 点击打开 RuntimeOutputModal

#### 4. TaskBoard.tsx
closeModal 行为不变（清空 UI 状态），因为后端已缓冲。

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望在 TaskBoard 中启动 Claude Code 执行后，即使关闭了任务详情弹窗，
也能通过 StatusBar 重新查看 Claude Code 的完整执行过程和实时输出。

### Scenarios (Given/When/Then)

#### Scenario 1: 关闭弹窗后重新查看执行输出
```gherkin
Given 一个 Claude Code session 正在执行中
And 用户关闭了 TaskBoard 的 Feature Detail Modal
When 用户点击 StatusBar 的 runtime 指示器
And 看到 "View Output" 按钮
And 点击 "View Output"
Then 应打开 RuntimeOutputModal
And 弹窗显示之前所有已缓冲的输出文本
And 弹窗实时接收并显示新的 chunk 输出
```

#### Scenario 2: 执行完成后查看完整输出
```gherkin
Given 一个 Claude Code session 已执行完成（is_done = true）
When 用户通过 StatusBar 打开 RuntimeOutputModal
Then 弹窗显示完整的执行输出
And 显示完成标记（✓ Completed）
And 不再接收新 chunk
```

#### Scenario 3: 无活跃 session 时不显示入口
```gherkin
Given 没有任何 Claude Code session 在运行或已完成
When 用户点击 StatusBar 的 runtime 指示器
Then Claude Code card 不显示 "View Output" 按钮
```

#### Scenario 4: 清理 session 输出
```gherkin
Given 用户已查看完 session 输出
When 用户在 RuntimeOutputModal 中点击 "Clear"
Then session buffer 被清理
And StatusBar 的 "View Output" 按钮消失
And 弹窗关闭
```

### UI/Interaction Checkpoints
- StatusBar runtime popover 内 "View Output" 按钮仅在有 active session 时可见
- RuntimeOutputModal 使用可拖拽 header + 自动滚动 + monospace 输出
- 输出按类型标注：[assistant], [tool_use], [system], [raw]
- 完成后显示绿色 ✓ 标记

### General Checklist
- [x] 后端 session_output 使用 Arc<Mutex<HashMap>> 保证线程安全
- [x] 前端 chunk 过滤逻辑与 TaskBoard 一致（仅显示 assistant/raw/system 类型）
- [x] 内存安全：clear 命令清理 buffer，防止无限增长

## Merge Record

- **completed**: 2026-04-08T19:35:00Z
- **merged_branch**: feature/feat-runtime-session-output
- **merge_commit**: e555dcf
- **archive_tag**: feat-runtime-session-output-20260408
- **conflicts**: none
- **verification**: passed (4/4 Gherkin scenarios, cargo check + tsc --noEmit pass)
- **duration**: ~30 minutes
- **commits**: 1
- **files_changed**: 4
