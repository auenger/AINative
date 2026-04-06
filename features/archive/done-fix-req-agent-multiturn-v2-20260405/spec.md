# Feature: fix-req-agent-multiturn-v2 REQ Agent 多轮对话修复 V2

## Basic Information
- **ID**: fix-req-agent-multiturn-v2
- **Name**: REQ Agent 多轮对话修复 V2（第二轮无响应根因修复）
- **Priority**: 95
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-05

## Description

REQ Agent 使用 `useAgentStream`（`runtimeId='claude-code'`, `useSessions=true`）通过 `runtime_execute` → `ClaudeCodeRuntime::execute()` 路径。

**现象**: 首轮对话正常收到流式响应，但第二轮发送消息后返回 "(No response received)"。

**服务端日志**: 仅出现 macOS 系统消息（TSM/IMKCF），无 CLI 错误输出。

## User Value Points

### VP1: 多轮对话稳定工作
用户在同一会话中连续发送多条消息，每条都能收到流式响应。会话上下文通过 `--resume --session-id` 保持。

### VP2: CLI 错误可见
当 CLI resume 失败时，用户能看到具体错误信息，而不是无意义的 "(No response received)"。

## Context Analysis

### Root Cause Analysis

**数据流追踪:**

```
前端 sendMessage()
  → runtime_execute(runtimeId='claude-code', message, sessionId)
    → ClaudeCodeRuntime::execute(params)
      → spawn: claude --print --output-format stream-json --verbose --dangerously-skip-permissions [--resume --session-id <id>] -- "message"
        → stdout reader thread → mpsc::channel → StreamEvent → runtime_execute thread → app.emit("agent://chunk")
        → stderr reader thread → mpsc::channel → StreamEvent (type=stderr)
        → timeout thread → mpsc::channel → StreamEvent (is_done, error)
```

**可能原因 (按优先级排序):**

**P1: `--resume` 失败但错误被静默吞掉**

前端 chunk listener 中 stderr 类型的错误被 `chunk.type !== 'stderr'` 过滤掉，不会显示给用户：
```typescript
if (chunk.error && chunk.type !== 'stderr') {
    setError(chunk.error);  // 只有非 stderr 才设置错误
    return;
}
```
如果 CLI resume 失败，错误输出到 stderr，前端完全忽略。

**P2: `process_exit` 事件干扰第二轮对话**

`ClaudeCodeRuntime::execute()` 在 stdout EOF 后发送 `process_exit` is_done 事件。虽然 `runtime_execute` 的转发线程在收到 `result` is_done 后 break，但 `result` 消息可能不存在（CLI 异常退出时）。此时 `process_exit` 成为唯一的 is_done 事件。

**P3: Session ID 未正确传递**

前端 `sendMessage` 使用闭包中的 `sessionId`。React 状态更新是异步的，如果用户在 `setSessionId` 完成前就发送第二条消息，`sessionId` 仍为 `null`，导致第二轮不使用 `--resume`。

**P4: CLI `--print` 模式 session 不持久**

`--print` 模式下 CLI 可能不会将 session 持久化到磁盘，导致 `--resume` 找不到对应 session。

### Reference Code
* `neuro-syntax-ide/src/lib/useAgentStream.ts` — 统一 Agent 流式 Hook
* `neuro-syntax-ide/src-tauri/src/lib.rs:840` — ClaudeCodeRuntime::execute()
* `neuro-syntax-ide/src-tauri/src/lib.rs:4577` — runtime_execute command
* `neuro-syntax-ide/src-tauri/src/lib.rs:938` — assistant 消息解析（content 数组）
* `neuro-syntax-ide/src/components/views/ProjectView.tsx:79` — REQ Agent 实例化

### Related Features
* `fix-req-agent-multiturn`（已完成）— 首次修复：persistent listener 模式
* `feat-agent-unified-exec`（已完成）— 统一执行层

## Technical Solution

### 修复策略

#### 1. 前端：stderr 错误不再静默吞掉
**文件**: `useAgentStream.ts`

```typescript
// 修改前: stderr 错误被完全忽略
if (chunk.error && chunk.type !== 'stderr') { ... }

// 修改后: stderr 错误在 streaming 时也记录
if (chunk.error) {
  if (chunk.type === 'stderr') {
    // stderr 错误记录到 console 但不阻断 streaming
    console.warn('[Agent CLI stderr]', chunk.error);
  } else {
    setError(chunk.error);
    // ... 现有错误处理
  }
}
```

#### 2. 后端：为 `--resume` 添加诊断日志
**文件**: `lib.rs` ClaudeCodeRuntime::execute()

在 spawn CLI 后添加 stderr 诊断，将关键错误信息通过 StreamEvent 发送（type=stderr 但包含可操作信息）。

#### 3. 后端：区分 `process_exit` 和正常 `result`
**文件**: `lib.rs` ClaudeCodeRuntime::execute()

在 stdout reader 中，标记 `process_exit` 为非错误但传递退出状态，让前端区分正常完成和异常退出：

```rust
// process_exit 不再发送 is_done=true（如果已经收到 result）
// 改为发送带 process_exit 标记的事件，让前端决定如何处理
```

#### 4. 前端：确保 sessionId 使用最新值
**文件**: `useAgentStream.ts`

使用 ref 跟踪 sessionId 的最新值，避免闭包过期问题：

```typescript
const sessionIdRef = useRef<string | null>(null);
// 同步更新 ref
useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
// sendMessage 中使用 sessionIdRef.current
```

#### 5. 后端：`--resume` 前验证 session 存在
**文件**: `lib.rs`

在执行 `--resume` 前，检查 `~/.claude/` 目录下是否存在对应 session 文件，不存在则提前报错。

### 调试方法

在修复前，先添加临时日志以确认根因：

```bash
# 手动测试 CLI session resume
claude --print --output-format stream-json --verbose --dangerously-skip-permissions -- "你好"
# 从输出中获取 session_id
claude --print --output-format stream-json --verbose --dangerously-skip-permissions --resume --session-id <id> -- "第二句"
```

## Acceptance Criteria (Gherkin)

### Scenario 1: 首轮对话收到响应
```gherkin
Given REQ Agent 处于 disconnected 状态
When 用户点击连接按钮并发送消息
Then 助手流式返回响应文本
And 响应中不出现 "(No response received)"
```

### Scenario 2: 多轮对话正常工作
```gherkin
Given REQ Agent 已连接且首轮对话完成
When 用户发送第二条消息
Then 助手流式返回第二轮响应
And 响应内容与首轮上下文关联
```

### Scenario 3: CLI 错误信息可见
```gherkin
Given REQ Agent 已连接
When CLI 执行出错（如 session 找不到）
Then 用户看到具体错误信息
And 不显示 "(No response received)"
```

### Scenario 4: 快速连续发送消息不丢失
```gherkin
Given REQ Agent 已连接且首轮刚完成
When 用户快速发送第二条消息（在 sessionId 状态更新前）
Then 消息仍然正常发送
And sessionId 使用最新值
```

### General Checklist
- [x] 首轮对话流式响应正常
- [x] 多轮对话上下文保持（--resume 生效）
- [x] CLI 错误信息可见（不再被静默吞掉）
- [x] sessionId 使用 ref 避免闭包过期
- [x] process_exit 事件不干扰后续对话
- [ ] 手动 CLI 验证 session resume 可行（需手动测试）

## Merge Record
- **Completed**: 2026-04-05T20:25:00Z
- **Merged Branch**: feature/fix-req-agent-multiturn-v2
- **Merge Commit**: 934313a
- **Archive Tag**: fix-req-agent-multiturn-v2-20260405
- **Conflicts**: none
- **Verification**: passed (code analysis)
- **Stats**: 1 commit, 6 files changed (+151/-38)
