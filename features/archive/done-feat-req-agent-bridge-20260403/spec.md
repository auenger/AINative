# Feature: feat-req-agent-bridge Claude Code CLI 桥接服务

## Basic Information
- **ID**: feat-req-agent-bridge
- **Name**: Claude Code CLI 桥接服务
- **Priority**: 75
- **Size**: S
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description
在 Tauri Rust 后端实现 Claude Code CLI 子进程管理服务，作为需求分析 Agent 的通信桥梁。通过 `--print --output-format stream-json --input-format stream-json` 模式建立双向 JSON 流通信，支持会话生命周期管理和流式响应转发。

## User Value Points
1. **CLI 子进程管理** — 可靠地 spawn、监控、重启 Claude Code CLI 子进程
2. **双向 JSON 流通信** — 通过 stdin/stdout 实现消息发送和流式响应接收
3. **会话持久化** — 通过 `--session-id` / `--resume` 支持会话保存和恢复

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:1016-1151` — 现有 PM Agent 的流式通信实现（参考 SSE 模式）
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — 前端 hook 的消息类型定义
- Claude Code CLI 支持 `--output-format stream-json --input-format stream-json`

### Related Documents
- CLAUDE.md — 项目技术栈约束

### Related Features
- feat-req-agent-chat — 依赖本 feature 的 Tauri IPC 命令
- feat-req-agent-workflow — 依赖本 feature 的会话管理

## Technical Solution

### 架构
```
Tauri Command (IPC)
    ↓
ReqAgentService (struct, State)
    ├─ process: Option<Child>          // Claude CLI 子进程
    ├─ session_id: Option<String>      // 当前会话 ID
    ├─ stdin: Option<BufWriter<ChildStdin>>
    └─ stdout_reader: Option<BufReader<ChildStdout>>
    ↓
claude --print \
  --output-format stream-json \
  --input-format stream-json \
  --system-prompt "..." \
  --allowedTools "Read Write Glob Grep Bash" \
  --permission-mode acceptEdits \
  --session-id {uuid}
```

### Tauri Commands
1. `req_agent_start(session_id: Option<String>)` — 启动/恢复会话
2. `req_agent_send(message: String)` — 发送用户消息到 stdin
3. `req_agent_stop()` — 终止子进程
4. `req_agent_status()` → `{ running: bool, session_id: Option<String> }`

### 流式响应
- 后台线程读取子进程 stdout，解析 stream-json
- 每个有效 chunk 通过 `app.emit("req_agent_chunk", ...)` 推送到前端
- 格式与现有 `pm_agent_chunk` 对齐，便于前端复用

### stream-json 协议
Claude CLI stream-json output 格式（参考）:
```json
{"type":"assistant","subtype":"text","content":"...","session_id":"..."}
{"type":"result","subtype":"success","cost_usd":0.01,"duration_ms":1234}
```

stdin input (stream-json):
```json
{"type":"user","content":"用户消息"}
```

### 错误处理
- 子进程意外退出 → 自动重启 + 通知前端
- CLI 未安装 → 明确错误提示 "Claude Code CLI not found"
- 认证失败 → 提示用户运行 `claude auth`

## Acceptance Criteria (Gherkin)
### User Story
作为 IDE 开发者，我需要一个可靠的 Claude Code CLI 桥接服务，以便前端 UI 可以通过 Tauri IPC 与 Claude Agent 通信。

### Scenarios
```gherkin
Scenario: 启动需求分析 Agent 会话
  Given 用户已安装 Claude Code CLI 并完成认证
  When 前端调用 req_agent_start()
  Then Tauri 后端 spawn Claude CLI 子进程
  And 返回成功状态和 session_id
  And 子进程通过 stream-json 模式等待输入

Scenario: 发送消息并接收流式响应
  Given Agent 会话已启动
  When 前端调用 req_agent_send("帮我分析用户登录功能的需求")
  Then 消息通过 stdin JSON 发送到 Claude CLI
  And 后台线程读取 stdout 并解析 stream-json
  And 每个 chunk 通过 req_agent_chunk 事件推送到前端
  And 最终收到 type=result 的完成事件

Scenario: 恢复已有会话
  Given 存在一个历史 session_id
  When 前端调用 req_agent_start(session_id)
  Then Claude CLI 以 --resume 模式启动
  And 历史对话上下文恢复

Scenario: CLI 未安装
  Given 用户未安装 Claude Code CLI
  When 前端调用 req_agent_start()
  Then 返回错误 "Claude Code CLI not found"
  And 不尝试 spawn 子进程

Scenario: 子进程意外退出
  Given Agent 会话正在运行
  When Claude CLI 子进程异常退出
  Then 后端检测到退出并 emit 错误事件
  And 前端显示 "Agent 会话已断开" 提示
```

### General Checklist
- [ ] 子进程生命周期管理正确（启动、停止、重启）
- [ ] stdin/stdout JSON 流解析健壮
- [ ] 会话 ID 持久化和恢复工作正常
- [ ] 错误场景有明确提示
- [ ] 不阻塞 Tauri 主线程（异步后台读取）

## Merge Record
- **Completed**: 2026-04-03T19:00:00Z
- **Merged Branch**: feature/feat-req-agent-bridge
- **Merge Commit**: e7a40e2
- **Archive Tag**: feat-req-agent-bridge-20260403
- **Conflicts**: none
- **Verification**: passed (5/5 Gherkin scenarios, cargo check + clippy clean)
- **Stats**: 1 commit, 1 file changed, 377 insertions
