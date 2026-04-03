# Feature: fix-reqagent-connection ReqAgent Claude Code 连接修复

## Basic Information
- **ID**: fix-reqagent-connection
- **Name**: ReqAgent Claude Code 连接修复（首次无响应 + 重连自动断开）
- **Priority**: 75
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description

项目页面 ReqAgent 连接 Claude Code 存在两个 bug：
1. 首次连接成功，但发送消息后无响应（对话不回复）
2. 第二次点击连接按钮后自动断开

## Root Cause Analysis

### Bug 1: 首次连接后无响应

**关键文件**: `neuro-syntax-ide/src-tauri/src/lib.rs`, `neuro-syntax-ide/src/lib/useReqAgentChat.ts`

1. **stdout reader 线程在 `result` 消息后 break**（lib.rs:2388-2390）
   - 当 CLI 返回 `{"type":"result",...}` 时，reader 线程立即 `break` 退出循环
   - 随后无条件发送 "disconnect" 事件（lib.rs:2409-2417）
   - 但此时前端的 listener 已在 `is_done` 处理中调用 `unlisten()`，disconnect 事件被错过

2. **`--print` 模式的单次交互特性**
   - `--print` 使 Claude CLI 处于单次执行模式：读一条 stdin → 处理 → 输出 → 退出
   - 进程在第一次响应后退出，后续消息无法送达
   - `req_agent_send` 检测到进程已死时返回错误，但前端未正确更新连接状态

3. **前端 listener 生命周期与进程生命周期不匹配**
   - `listen('req_agent_chunk')` 仅在 `sendMessage()` 内注册
   - session 启动时的 system init 消息无人接收（正常）
   - 但进程退出时的 disconnect 事件也无人在听，连接状态未更新

### Bug 2: 第二次连接自动断开

1. **复用已失效的 session ID**
   - `handleReqAgentStart` 从 localStorage 读取旧 session ID
   - 调用 `req_agent_start` 时传入旧 ID 并添加 `--resume` 标志
   - 新进程尝试 resume 一个已完成的 session，CLI 可能立即退出或报错
   - stdout reader 读到 EOF 后发送 disconnect 事件，前端显示断开

2. **错误事件触发断开逻辑**
   - 前端对带 `error` 的 chunk（非 stderr）直接设置 `connectionState = 'disconnected'`
   - 包括 disconnect 类型的消息，这会导致刚连接就立即断开

## User Value Points

1. **稳定的首次连接** — 连接后能正常发送消息并接收 AI 回复
2. **多轮对话持续** — 一次连接内可进行多轮对话，不会中途断开
3. **可靠的重连** — 断开后可正常重新连接（新会话），不会自动断开

## Technical Solution

### 方案：改为 per-message 进程模型 + 持久状态监听

核心思路：不再维持长驻进程，改为每条消息启动一个新 CLI 进程（用 `--resume` 保持会话上下文）。

#### Rust 侧改动 (`lib.rs`)

1. **新增 `req_agent_send_message` command**
   - 每次发送消息时启动新 `claude --print --resume --session-id <id>` 进程
   - 将用户消息作为命令行参数传入（或 stdin）
   - 读取 stdout 直到 `result` 消息或 EOF
   - 返回后进程自然退出，无需手动 kill

2. **简化 `req_agent_start`**
   - 不再启动长驻进程
   - 只做 CLI 可用性检查 + 生成/恢复 session ID
   - 返回 session ID 即可

3. **移除 `req_agent_send`**
   - 替换为 `req_agent_send_message`（per-message 模式）

4. **stdout reader 不再 break on result**
   - 保持读取直到 EOF，确保所有消息都被处理
   - 移除 reader 退出后的 disconnect 事件（进程自然结束不需要）

#### Frontend 侧改动 (`useReqAgentChat.ts`)

1. **注册持久 listener**
   - 在 `startSession` 成功后注册 `req_agent_chunk` listener
   - 持续监听直到 `stopSession` 或组件卸载
   - 处理 disconnect 事件更新连接状态

2. **`sendMessage` 简化**
   - 不再自行注册/注销 listener
   - 调用 `req_agent_send_message`（新的 per-message command）
   - 通过持久 listener 接收所有响应

3. **连接状态正确管理**
   - `req_agent_send_message` 失败时更新连接状态为 error
   - disconnect 事件时清理 session ID（不清除消息历史）
   - 重连时使用新的 session ID，不尝试 resume

4. **重连逻辑修复**
   - `handleReqAgentStart` 不再从 localStorage 取旧 session ID
   - 每次连接都是新 session（或由 Rust 侧决定是否可 resume）

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望 ReqAgent 能稳定连接 Claude Code 并进行多轮对话，以便持续分析需求。

### Scenarios

```gherkin
Scenario: 首次连接后发送消息获得响应
  Given ReqAgent 处于断开状态
  When 用户点击连接按钮
  Then 连接状态显示为 "已连接"
  When 用户输入 "帮我分析一个用户登录功能的需求" 并发送
  Then AI 在 10 秒内开始返回响应文本
  And 响应文本流式显示在聊天窗口中
  And 响应完成后连接状态仍为 "已连接"

Scenario: 一次连接内多轮对话
  Given ReqAgent 已连接且有历史对话
  When 用户发送第二条消息 "请细化第二个子模块"
  Then AI 基于上下文返回后续分析
  And 连接状态保持 "已连接"

Scenario: 断开后可正常重连
  Given ReqAgent 处于已连接状态
  When 用户点击断开按钮
  Then 连接状态变为 "已断开"
  When 用户再次点击连接按钮
  Then 新会话成功建立
  And 聊天历史被清除并显示欢迎消息
  And 用户可以正常发送消息并获得响应

Scenario: CLI 不可用时显示友好错误
  Given Claude CLI 未安装
  When 用户点击连接按钮
  Then 显示错误提示 "Claude Code CLI not found"
  And 连接状态变为 "错误"

Scenario: 发送失败时自动更新状态
  Given ReqAgent 已连接
  When 消息发送因网络或 API 错误失败
  Then 显示错误信息
  And 连接状态更新为 "错误"
  And 用户可点击重试
```

### UI/Interaction Checkpoints
- 连接状态指示灯：绿色=已连接，黄色=连接中，红色=错误，灰色=断开
- 错误信息以 banner 形式显示在聊天区顶部
- Streaming 时显示 "Thinking..." 状态

### General Checklist
- 不引入新依赖
- 保持现有 UI 视觉风格不变
- 错误消息中英文国际化
- localStorage session 持久化机制保持一致

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:2116-2541` — Rust ReqAgent 实现
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — 前端 hook
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:240-266` — UI 交互处理

### Related Documents
- Claude Code CLI `--print` 模式文档
- Claude Code CLI `stream-json` 输入输出格式

### Related Features
- feat-req-agent-bridge (已完成) — Claude Code CLI 桥接服务
- feat-req-agent-chat (已完成) — 聊天 UI
- feat-req-agent-workflow (已完成) — 需求分析工作流

## Merge Record
- **Completed**: 2026-04-03
- **Merged Branch**: feature/fix-reqagent-connection
- **Merge Commit**: ec3266c
- **Archive Tag**: fix-reqagent-connection-20260403
- **Conflicts**: none
- **Verification**: passed (18/18 tasks, 5/5 Gherkin scenarios, TypeScript 0 errors, Rust 0 warnings)
- **Files Changed**: 3 (lib.rs, useReqAgentChat.ts, ProjectView.tsx)
- **Stats**: 208 insertions, 191 deletions
