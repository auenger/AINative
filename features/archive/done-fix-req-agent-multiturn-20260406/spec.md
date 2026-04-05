# Feature: fix-req-agent-multiturn REQ Agent 多轮对话修复 + 状态初始化

## Basic Information

* **ID**: fix-req-agent-multiturn

* **Name**: REQ Agent 多轮对话修复 + 状态初始化

* **Priority**: 90

* **Size**: M

* **Dependencies**: none

* **Parent**: null

* **Children**: none

* **Created**: 2026-04-04

## Description

REQ Agent（使用 claude-code runtime + useSessions=true）存在以下问题：

1. **首次对话无响应**（已修复）：CLI 缺少 `--verbose` 参数导致报错；`assistant` JSON 解析方式不匹配 CLI v2.1.92 新格式；`runtime_session_start` 生成的假 UUID 导致 `--resume` 失败

2. **多轮对话无响应**：首轮响应完成后 chunk listener 被 `unlisten()` 销毁（per-request 模式），第二轮 `sendMessage` 因 `useSessions=true` 跳过 `registerChunkListener()`，导致无 listener 接收事件

3. **状态初始化不完整**：停止会话/新建会话时，前端状态和 Rust 后端状态清理不一致

## User Value Points

### VP1: 多轮对话正常工作

用户在同一会话中连续发送多条消息，每条都能收到流式响应。会话上下文通过 `--resume --session-id` 在 Claude CLI 层面保持。

### VP2: 会话生命周期状态一致

停止会话/新建会话时，前端（sessionId、connectionState、messages）和 Rust 后端（req_agent.process/session_id）状态完全清理，不留残留。

## Context Analysis

### Reference Code

* `neuro-syntax-ide/src/lib/useAgentStream.ts` — 统一 Agent 流式 Hook（REQ Agent 使用此 hook）

* `neuro-syntax-ide/src-tauri/src/lib.rs` — `runtime_execute`、`runtime_session_start/stop`、`ClaudeCodeRuntime::execute`

* `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — 旧版 Hook（已弃用，但有正确的 persistent listener 参考）

* `neuro-syntax-ide/src/components/views/ProjectView.tsx:79` — REQ Agent 实例化处

### Root Cause Analysis

**问题 1 — 首次无响应**（已修复，本轮验证）：

* Rust `execute()` 缺少 `--verbose` 参数 → CLI 报错退出

* `assistant` 消息文本在 `message.content[].text`（数组），不是顶层 `content` 字符串

* `runtime_session_start` 生成假 UUID → `--resume` 找不到会话

**问题 2 — 多轮无响应**：

```text
第一轮: startSession → registerChunkListener → listener 活跃
        sendMessage → runtime_execute → 收到 chunks → is_done → unlisten() ← listener 被销毁
第二轮: sendMessage → useSessions=true → 跳过 registerChunkListener → 无 listener → 收不到响应
```

修复方案：当 `useSessions=true` 时，listener 应该是 persistent 模式（不随 is_done 销毁），只在 `stopSession` 或 unmount 时清理。

**问题 3 — 状态初始化**：

* `runtime_session_stop` 清理 `req_agent` 状态，但 `runtime_execute` 不更新 `req_agent.process`

* `stopSession` 后 `checkStatus` 可能读到过期数据

* 新建会话时 `streamingTextRef` 和 error 状态可能残留

### Related Documents

* CLI 测试验证结果：`claude --print --output-format stream-json --verbose --dangerously-skip-permissions -- "msg"` 正常输出

### Related Features

* `feat-agent-unified-exec`（已完成）— 统一执行层

* `fix-reqagent-connection`（已完成）— 首次连接修复

## Technical Solution

### 1. useAgentStream.ts — Persistent Listener 模式

**改动**：当 `useSessions=true` 时，`is_done` 不调用 `unlisten()`，listener 保持活跃直到 `stopSession` 或 unmount。

```typescript
// registerChunkListener 中 is_done 处理：
if (chunk.is_done) {
  setIsStreaming(false);
  if (!streamingTextRef.current) {
    setMessages(prev => [...prev, { role: 'assistant', content: '(No response received)' }]);
  }
  // Per-request 模式才 unlisten；session 模式保持 listener 持久
  if (!useSessions) {
    unlisten();
    chunkUnlistenRef.current = null;
  }
}
```

### 2. useAgentStream.ts — sendMessage 中为 session 模式确保 listener 存在

```typescript
// sendMessage 中：
if (useSessions) {
  // 确保 session 模式下 listener 存在（防止意外丢失）
  if (!chunkUnlistenRef.current) {
    await registerChunkListener();
  }
} else {
  await registerChunkListener();
}
```

### 3. Rust backend — runtime_session_start 不存假 UUID

已修复：`startSession` 不存储 `runtime_session_start` 返回的 UUID，sessionId 从首个响应 chunk 中捕获。

### 4. 状态清理 — stopSession / newSession

确保 `stopSession` 完整清理：

* 前端：`sessionId = null`、`connectionState = 'disconnected'`、`streamingTextRef = ''`、`error = null`

* 后端：`runtime_session_stop` 清理 `req_agent` 状态

* Listener：`removeChunkListener()` 清理

### 5. 端到端验证

使用 CLI 模拟完整流程：

```bash
# 首次无 session
claude --print --output-format stream-json --verbose --dangerously-skip-permissions -- "hello"
# 从响应捕获 session_id
# 多轮用 --resume
claude --print --output-format stream-json --verbose --dangerously-skip-permissions --resume --session-id <id> -- "follow up"
```

## Acceptance Criteria (Gherkin)

### Scenario 1: 首次对话收到响应

```gherkin
Given REQ Agent 处于 disconnected 状态
When 用户点击连接按钮
And 用户输入消息并发送
Then 连接状态变为 connected
And 助手流式返回响应文本
And 助手消息中不出现 "(No response received)"
```

### Scenario 2: 多轮对话正常工作

```gherkin
Given REQ Agent 已连接且首轮对话完成
When 用户发送第二条消息
Then 助手流式返回第二轮响应
And 响应内容与首轮上下文关联（--resume 生效）
```

### Scenario 3: 停止会话完全清理

```gherkin
Given REQ Agent 已连接
When 用户点击停止按钮
Then connectionState 变为 disconnected
And sessionId 变为 null
And chunk listener 被清理
And 后端 req_agent 状态被清理
```

### Scenario 4: 新建会话重置所有状态

```gherkin
Given REQ Agent 已有对话历史
When 用户点击新建会话按钮
Then 消息列表被清空（仅保留 greeting）
And sessionId 变为 null
And streamingTextRef 和 error 被重置
```

### Scenario 5: 意外 listener 丢失自动恢复

```gherkin
Given REQ Agent 已连接但 chunk listener 意外丢失（chunkUnlistenRef.current 为 null）
When 用户发送消息
Then sendMessage 检测到 listener 缺失并重新注册
And 助手正常返回响应
```

### General Checklist

* [ ] 首次对话流式响应正常
* [ ] 多轮对话上下文保持
* [ ] 停止会话状态完全清理
* [ ] 新建会话状态完全重置
* [ ] CLI `--verbose` 参数已添加
* [ ] `assistant` JSON 新格式解析正确
* [ ] `result` 类型 `is_error` 检测正确
* [ ] 无 console 错误（非 Monaco clipboard 相关）

⠀