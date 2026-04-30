# Feature: feat-agent-acp-adapter ACP JSON-RPC 2.0 Adapter

## Basic Information
- **ID**: feat-agent-acp-adapter
- **Name**: ACP JSON-RPC 2.0 Adapter（Codex / Hermes / Kiro / Kimi / Pi）
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-agent-stdio-core
- **Parent**: feat-universal-agent-runtime
- **Children**: none
- **Created**: 2026-04-29

## Description

在 feat-agent-stdio-core 的基础上，实现 **ACP adapter** — 通过 JSON-RPC 2.0 over stdin/stdout 与 agent CLI 通信。覆盖支持 ACP（Agent Client Protocol）或类似 JSON-RPC 协议的 agent：Codex、Hermes、Kiro CLI、Kimi、Pi/OpenClaw。

ACP 模式特点：
- **双向通信**：stdin/stdout 持续开放，支持多轮请求/响应
- **会话持久**：支持 create session / load session / cancel session
- **结构化协议**：JSON-RPC 2.0 标准，有 request-id 路由
- **事件驱动**：agent 通过 notification 主动推送状态变更

## User Value Points

1. **Codex JSON-RPC 通信** — 通过 `codex app-server --listen stdio://` 实现双向任务执行
2. **ACP 协议通用适配** — 一个 JSON-RPC 客户端覆盖 Hermes / Kiro / Kimi / Pi 等所有 ACP agent
3. **会话管理与多轮对话** — 持久 session + cancel + resume 能力

## Context Analysis

### Reference Code
- Multica `server/pkg/agent/codex.go` — `codexClient` JSON-RPC 实现
- Multica `server/pkg/agent/agent.go` — `Backend` trait

### JSON-RPC 2.0 over stdio 协议

```jsonc
// Request (IDE → Agent)
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
{"jsonrpc":"2.0","id":2,"method":"thread/start","params":{"prompt":"..."}}
{"jsonrpc":"2.0","id":3,"method":"turn/start","params":{}}

// Response (Agent → IDE)
{"jsonrpc":"2.0","id":1,"result":{"capabilities":{...}}}
{"jsonrpc":"2.0","id":2,"result":{"thread_id":"..."}}
{"jsonrpc":"2.0","id":3,"result":{"turn_id":"..."}}

// Notification (Agent → IDE, 主动推送)
{"jsonrpc":"2.0","method":"codex/event","params":{"type":"message","content":"..."}}
{"jsonrpc":"2.0","method":"turn/completed","params":{"status":"success"}}

// Server-initiated Request (Agent → IDE, 需要回复)
{"jsonrpc":"2.0","id":100,"method":"approval/request","params":{"tool":"Write","path":"..."}}
// IDE 回复
{"jsonrpc":"2.0","id":100,"result":{"decision":"accept"}}
```

### 各 Agent ACP 差异

| Agent | 启动命令 | 初始化方法 | 会话方法 | 完成信号 |
|-------|---------|-----------|---------|---------|
| **Codex** | `codex app-server --listen stdio://` | `initialize` → `initialized` | `thread/start` → `turn/start` | `turn/completed` notification |
| **Hermes** | `hermes acp` | `initialize` | `newSession` / `loadSession` / `cancelSession` | `session/idle` notification |
| **Kiro** | `kiro-cli acp` | `initialize` | `createSession` / `prompt` | 完成响应或 notification |
| **Kimi** | `kimi acp` | `initialize` | `session/create` / `session/prompt` | 类似 Hermes |
| **Pi** | `pi --mode rpc` | JSONL RPC `initialize` | session 管理 | `task/complete` |

## Coexistence Strategy（方案 B — 适配层共存）

> **核心原则**: ACPAdapter 基于新增的 StdioSessionManager，不修改现有 AgentRuntime trait。ACP（JSON-RPC 2.0）通信通过新路径 `acp_execute` 实现，与现有 `runtime_execute` 完全隔离。

### 与现有 CodexRuntime 的关系

```
现有 Codex 执行路径（不动）:
  useAgentStream.ts → invoke('runtime_execute', {runtimeId: 'codex'})
  → CodexRuntime.execute() → 自己 spawn "codex" → agent://chunk

新 ACP 执行路径（本 feature）:
  useStdioAgent.ts → invoke('acp_execute', {agentType: 'codex'})
  → AcpAdapter.execute() → StdioSessionManager.spawn()
  → JsonRpcClient → initialize → thread/start → turn/start → agent://message
```

**关键区别**:
- 现有 CodexRuntime: 简单 CLI spawn，stdout 解析，单向流
- 新 ACP 路径: JSON-RPC 2.0 双向通信，支持 cancel / session 管理
- 两条路径独立运行，同一 agent（如 Codex）可走不同路径

### 共存规则

1. **CodexRuntime 不修改** — 现有的 execute() 方法继续用自己的逻辑
2. **acp_execute / acp_cancel / acp_list_sessions 是新增 commands** — 不覆盖 `runtime_execute`
3. **AcpAdapter 使用 StdioSessionManager** — 不直接 spawn 进程
4. **JsonRpcClient 在 StdioSessionManager 的 stdout 轮询基础上实现** — 不是独立 read loop
5. **agent://message 事件与 agent://chunk 隔离** — 前端通过不同 hook 消费
6. **前端 useAgentStream.ts 不修改** — 新增 `executeAcpAgent()` 在 useStdioAgent.ts 中

## Technical Solution

### Rust ACP Adapter 实现

```rust
/// JSON-RPC 2.0 请求管理器
struct JsonRpcClient {
    next_id: AtomicU32,
    pending: Arc<Mutex<HashMap<u32, oneshot::Sender<Value>>>>,
    notification_tx: broadcast::Sender<RpcNotification>,
}

impl JsonRpcClient {
    /// 发送 JSON-RPC request 并等待 response
    async fn request(&self, method: &str, params: Value) -> Result<Value, RpcError> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        // 写入 stdin
        // 等待 rx
    }

    /// 发送 JSON-RPC notification（无 id，不期待 response）
    async fn notify(&self, method: &str, params: Value) -> Result<(), RpcError> {
        // 写入 stdin，无 id 字段
    }

    /// 处理从 stdout 读到的行
    fn handle_line(&self, line: &str) {
        if has_id(line) {
            // route to pending oneshot
        } else if has_method(line) {
            // server-initiated request or notification
            // dispatch to notification_tx or auto-respond
        }
    }
}

/// ACP 协议适配器
struct AcpAdapter {
    session_manager: Arc<StdioSessionManager>,
    rpc_client: Arc<JsonRpcClient>,
}

impl AcpAdapter {
    /// 完整执行流程
    async fn execute(&self, config: AgentConfig, prompt: String) -> Result<AcpSession, String> {
        // 1. spawn 子进程
        // 2. 启动 stdout reader task → rpc_client.handle_line()
        // 3. send "initialize" request
        // 4. send agent-specific session start
        // 5. send prompt
        // 6. 等待 completion notification
    }
}
```

### Tauri IPC Commands（ACP 专用）

```rust
#[tauri::command]
async fn acp_execute(
    agent_type: String,
    prompt: String,
    working_dir: String,
    timeout: Option<u64>,
    model: Option<String>,
) -> Result<AcpSession, String>

#[tauri::command]
async fn acp_cancel(session_id: String) -> Result<(), String>

#[tauri::command]
async fn acp_list_sessions() -> Result<Vec<AcpSessionInfo>, String>
```

### Agent 配置表

```yaml
acp_agents:
  codex:
    binary: "codex"
    args: ["app-server", "--listen", "stdio://"]
    protocol: acp
    init_method: "initialize"
    session_methods:
      start: "thread/start"
      turn: "turn/start"
      cancel: "thread/cancel"
    completion_signal: "turn/completed"
    env_filter: []  # 不需要过滤环境变量

  hermes:
    binary: "hermes"
    args: ["acp"]
    protocol: acp
    init_method: "initialize"
    session_methods:
      start: "newSession"
      cancel: "cancelSession"
      fork: "forkSession"
    completion_signal: "session/idle"

  kiro:
    binary: "kiro-cli"
    args: ["acp"]
    protocol: acp
    init_method: "initialize"

  kimi:
    binary: "kimi"
    args: ["acp"]
    protocol: acp
    init_method: "initialize"

  pi:
    binary: "pi"
    args: ["--mode", "rpc"]
    protocol: acp
    init_method: "initialize"
```

### 自动审批机制

```rust
/// ACP agent 发来的 server-initiated request 自动处理
fn handle_server_request(method: &str, params: Value) -> Value {
    match method {
        "approval/request" | "command/approval" | "file/approval" => {
            json!({"decision": "accept"})
        }
        _ => json!({})
    }
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望通过 IDE 直接驱动 Codex/Hermes/Kiro 等 ACP agent 执行任务，实时看到执行过程，并能取消正在执行的任务。

### Scenarios

#### Scenario 1: Codex JSON-RPC 执行
```gherkin
Given IDE 中选择了 Codex agent
And 工作区目录为 /path/to/project
When 用户输入 "添加 unit test" 并执行
Then Rust 后端 spawn "codex app-server --listen stdio://" 子进程
And 通过 JSON-RPC 发送 initialize → initialized → thread/start → turn/start
And 前端实时收到 assistant message 和 tool use 通知
And 收到 turn/completed 通知后显示完成
```

#### Scenario 2: Hermes ACP 执行
```gherkin
Given IDE 中选择了 Hermes agent
When 用户输入任务并执行
Then Rust 后端 spawn "hermes acp" 子进程
And JSON-RPC 发送 initialize → newSession
And 前端实时收到消息流
And 收到 session/idle 通知后显示完成
```

#### Scenario 3: 取消执行
```gherkin
Given Codex 正在执行一个任务
When 用户点击取消按钮
Then 后端通过 JSON-RPC 发送 thread/cancel
And 子进程收到取消信号后退出
And 前端显示 "已取消" 状态
```

#### Scenario 4: Agent 审批自动通过
```gherkin
Given Hermes 正在执行任务
When Hermes 通过 JSON-RPC 发送 approval/request
Then 后端自动回复 {"decision": "accept"}
And agent 继续执行
```

#### Scenario 5: JSON-RPC 错误处理
```gherkin
Given Codex 正在执行任务
When JSON-RPC 返回 error response（如 method not found）
Then 后端记录错误日志
And 前端显示具体错误信息
And session 状态变为 error
```

#### Scenario 6: 与现有 CodexRuntime 共存
```gherkin
Given 现有 CodexRuntime 通过 runtime_execute 注册在 registry 中
When ACPAdapter 通过 acp_execute 同样支持 Codex
Then 两条路径共存
And runtime_execute → CodexRuntime 继续通过 agent://chunk 工作
And acp_execute → AcpAdapter 通过 agent://message 工作
And 用户可以选择使用哪条路径
```

### General Checklist
- [ ] JsonRpcClient 实现完整的 request/notification/response 路由（基于 StdioSessionManager）
- [ ] 支持 Codex、Hermes、Kiro、Kimi、Pi 五种 agent 的 ACP 差异
- [ ] 自动审批机制正确响应 server-initiated requests
- [ ] 取消功能通过 JSON-RPC cancel 方法实现
- [ ] 前端能渲染 ACP adapter 消息
- [ ] acp_execute 等新增 commands 与现有 runtime_execute 并行注册
- [ ] agent://message 事件格式独立于 agent://chunk
- [ ] 现有 CodexRuntime 执行链路零影响（回归验证）
