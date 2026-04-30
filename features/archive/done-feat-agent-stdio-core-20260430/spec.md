# Feature: feat-agent-stdio-core Agent Stdio 通信核心抽象层

## Basic Information
- **ID**: feat-agent-stdio-core
- **Name**: Agent Stdio 通信核心抽象层
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: feat-universal-agent-runtime
- **Children**: none
- **Created**: 2026-04-29

## Description

为 Neuro Syntax IDE 建立统一的 agent stdio 通信核心抽象层。通过 stdin/stdout 管道与 agent CLI 子进程通信，取代之前的单一 `runtime_execute` 模式，为上层 Pipe adapter（NDJSON）和 ACP adapter（JSON-RPC 2.0）提供统一基础。

核心设计参考 Multica 的 daemon 架构：Rust 后端 spawn agent CLI 子进程，通过 stdin 发送消息、stdout 接收流式响应，前端通过 Tauri IPC 调用。

## User Value Points

1. **统一 Agent 进程管理** — 单一接口创建/销毁/健康检查任意 agent CLI 子进程
2. **结构化通信基座** — 为 Pipe（NDJSON）和 ACP（JSON-RPC 2.0）两种协议提供通用抽象

## Context Analysis

### Reference Code
- Multica `server/pkg/agent/agent.go` — `Backend` interface + `Session` struct
- Multica `server/internal/daemon/daemon.go` — `runTask()` 生命周期管理
- 当前项目 `neuro-syntax-ide/src/lib/useAgentStream.ts` — 现有 runtime_execute 调用
- 当前项目 `src-tauri/src/lib.rs` — 现有 Tauri commands

### Agent CLI 启动参数参考

| Agent | 启动命令 | 协议类型 |
|-------|---------|---------|
| Claude Code | `claude -p --output-format stream-json --input-format stream-json --verbose` | Pipe (NDJSON) |
| Cursor Agent | `agent -p --output-format stream-json` | Pipe (NDJSON) |
| OpenCode | `opencode run --format json` | Pipe (NDJSON) |
| Codex | `codex app-server --listen stdio://` | ACP (JSON-RPC) |
| Hermes | `hermes acp` | ACP (JSON-RPC) |
| Kiro CLI | `kiro-cli acp` | ACP (JSON-RPC) |
| Kimi | `kimi acp` | ACP (JSON-RPC) |
| Pi/OpenClaw | `pi --mode rpc` | ACP (JSON-RPC) |

### Related Features
- feat-agent-pipe-adapter (依赖本 feature)
- feat-agent-acp-adapter (依赖本 feature)

## Coexistence Strategy（方案 B — 适配层共存）

> **核心原则**: StdioSessionManager 作为新底层能力，不替换现有 AgentRuntime trait 和 runtime_execute 命令链路。两套系统通过适配桥接共存。

### 与现有系统的关系

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (React)                    │
│                                                       │
│  现有路径（不修改）:            新路径（本 feature）:     │
│  useAgentStream.ts             useStdioAgent.ts       │
│  listen('agent://chunk')       listen('agent://raw-*')│
│  invoke('runtime_execute')     invoke('agent_spawn')  │
├──────────────────────────────────────────────────────┤
│                    Tauri IPC Layer                     │
│                                                       │
│  runtime_execute (不变)         agent_spawn (新增)     │
│  → agent://chunk               → agent://raw-stdout  │
│                                → agent://session-status│
├──────────────────────────────────────────────────────┤
│                    Rust Backend                        │
│                                                       │
│  ┌──────────────────┐   ┌─────────────────────────┐  │
│  │ AgentRuntime     │   │ StdioSessionManager     │  │
│  │ trait (不变)      │   │ (新增，独立模块)         │  │
│  │ ├ ClaudeCode     │   │ - spawn / destroy       │  │
│  │ ├ CodexRuntime   │   │ - send_raw / read_raw   │  │
│  │ └ GeminiHttp     │   │ - health_check          │  │
│  └──────────────────┘   └─────────────────────────┘  │
│         ↑                          ↑                  │
│    保持原样                    PipeAdapter / ACPAdapter│
│    不改 execute()             使用这个底层              │
└──────────────────────────────────────────────────────┘
```

### 共存规则

1. **现有 AgentRuntime trait 不修改** — `ClaudeCodeRuntime.execute()` 继续使用自己的 spawn 逻辑，返回 `mpsc::Receiver<StreamEvent>`
2. **runtime_execute command 不修改** — 继续通过 `agent://chunk` 转发事件
3. **StdioSessionManager 是独立新增模块** — 不继承 AgentRuntime，不替换任何现有实现
4. **新增 Tauri commands 与现有 commands 并行注册** — `agent_spawn` / `agent_send_raw` 等是新增 command，不覆盖 `runtime_execute`
5. **新增 Tauri events 与现有 events 隔离** — `agent://raw-stdout` / `agent://session-status` / `agent://process-exit` 不影响 `agent://chunk`
6. **前端 useStdioAgent.ts 是新 hook** — 与 useAgentStream.ts 独立共存，后续 feature 可选择合并

### 未来迁移路径（不在本 feature 范围）

后续可将 `ClaudeCodeRuntime.execute()` 内部重构为调用 `StdioSessionManager`，但：
- AgentRuntime trait 签名不变
- `runtime_execute` command 行为不变
- `agent://chunk` 事件格式不变
- 这属于技术债优化，不影响外部行为

## Technical Solution

### Rust 核心类型

```rust
/// Agent 后端类型
enum AgentBackend {
    ClaudeCode,
    Codex,
    Hermes,
    OpenCode,
    Kiro,
    Kimi,
    CursorAgent,
    Pi,
}

/// 协议类型
enum ProtocolType {
    Pipe,   // NDJSON — 单向流式
    Acp,    // JSON-RPC 2.0 — 双向请求/响应
}

/// Agent 配置
struct AgentConfig {
    backend: AgentBackend,
    binary: String,              // CLI 二进制路径
    args: Vec<String>,           // 启动参数
    working_dir: String,         // 工作目录
    env: HashMap<String, String>,// 环境变量
    timeout: Option<Duration>,   // 超时
    protocol: ProtocolType,
}

/// Stdio Session — 子进程生命周期管理
struct StdioSession {
    id: String,
    config: AgentConfig,
    child: Child,                // std::process::Child
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    status: SessionStatus,       // Starting | Ready | Busy | Idle | Error | Stopped
    created_at: DateTime<Utc>,
    last_activity: DateTime<Utc>,
}

/// 统一消息类型（上层 adapter 转换为这个格式）
struct AgentMessage {
    session_id: String,
    role: MessageRole,           // System | Assistant | User | Tool
    content: AgentContent,       // Text | ToolUse | ToolResult | Thinking
    timestamp: DateTime<Utc>,
}

/// 统一结果
struct AgentResult {
    session_id: String,
    status: CompletionStatus,    // Completed | Failed | Aborted | Timeout
    duration: Duration,
    token_usage: Option<TokenUsage>,
}
```

### Tauri IPC Commands

```rust
#[tauri::command]
async fn agent_spawn(config: AgentConfig) -> Result<StdioSession, String>

#[tauri::command]
async fn agent_send_raw(session_id: String, data: String) -> Result<(), String>

#[tauri::command]
async fn agent_read_raw(session_id: String) -> Result<String, String>

#[tauri::command]
async fn agent_destroy(session_id: String) -> Result<(), String>

#[tauri::command]
async fn agent_list_sessions() -> Result<Vec<SessionInfo>, String>

#[tauri::command]
async fn agent_health_check(session_id: String) -> Result<SessionHealth, String>
```

### Tauri Events（Rust → 前端）

```rust
"agent://raw-stdout"   → { session_id, line: String }
"agent://session-status" → { session_id, status: SessionStatus }
"agent://process-exit" → { session_id, exit_code }
```

### 架构层次

```
┌─────────────────────────────────────────────┐
│              Frontend (React)                │
│   useAgentStream / useAgentRuntime hooks     │
├─────────────────────────────────────────────┤
│           Tauri IPC (invoke / listen)        │
├─────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ PipeAdapter │  │    ACPAdapter        │  │
│  │ (NDJSON)    │  │  (JSON-RPC 2.0)     │  │
│  └──────┬──────┘  └──────────┬───────────┘  │
│         │                    │              │
│  ┌──────┴────────────────────┴───────────┐  │
│  │     StdioSessionManager (本 feature)    │  │
│  │  spawn / stdin write / stdout read /    │  │
│  │  destroy / health / lifecycle           │  │
│  └────────────────┬───────────────────────┘  │
│                   │ std::process::Command     │
│                   ▼                          │
│          agent CLI 子进程                      │
│     stdin pipe ──► / stdout pipe ◄──          │
└─────────────────────────────────────────────┘
```

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我希望 IDE 能与多种 AI agent CLI 通信，这样我可以用同一个 IDE 管理不同 agent 执行任务。

### Scenarios

#### Scenario 1: 启动 agent 子进程
```gherkin
Given 用户在工作区中选择了 Claude Code 作为 agent
When 用户发送一个任务
Then IDE 通过 Rust 后端 spawn "claude -p --output-format stream-json" 子进程
And 前端收到 "agent://session-status" 事件，状态为 "ready"
```

#### Scenario 2: 子进程异常退出处理
```gherkin
Given 一个 agent 子进程正在运行
When agent CLI 进程崩溃退出（exit code != 0）
Then 前端收到 "agent://process-exit" 事件
And session 状态变为 "error"
And 错误信息包含 exit code 和 stderr 最后几行
```

#### Scenario 3: 超时终止
```gherkin
Given agent 配置了 300 秒超时
When agent 执行超过 300 秒无响应
Then Rust 后端自动 kill 子进程
And 前端收到 "agent://session-status" 事件，状态为 "timeout"
```

#### Scenario 4: 多 agent 并发隔离
```gherkin
Given 用户同时启动 Claude Code 和 Codex 两个 agent
When 两个 agent 分别执行任务
Then 每个 agent 有独立的 session_id
And 两个子进程的 stdin/stdout 完全隔离
And 前端能分别接收两个 agent 的消息流
```

#### Scenario 5: 与现有 runtime_execute 共存
```gherkin
Given 现有 ClaudeCodeRuntime 通过 runtime_execute 正在运行
When 用户同时通过 agent_spawn 启动一个新的 stdio session
Then 两套系统各自独立运行
And runtime_execute 仍然通过 agent://chunk 发送事件
And agent_spawn 通过 agent://raw-stdout 发送事件
And 互不干扰
```

### General Checklist
- [ ] Rust `StdioSessionManager` 实现完整的子进程生命周期管理（独立模块，不修改 AgentRuntime trait）
- [ ] 所有新增 Tauri commands（agent_spawn 等）注册到 lib.rs（与现有 commands 并行）
- [ ] 所有新增 Tauri events（agent://raw-stdout 等）与现有 agent://chunk 隔离
- [ ] 前端 useStdioAgent.ts 新 hook 独立实现，不修改 useAgentStream.ts
- [ ] 现有 runtime_execute → agent://chunk 链路零影响（回归验证）
