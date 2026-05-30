# Feature: feat-agent-provider-core Agent Provider 核心抽象层

## Basic Information
- **ID**: feat-agent-provider-core
- **Name**: Agent Provider 核心抽象层 — OpenClaw WebSocket 接入 + Hermes 增强
- **Priority**: 40
- **Size**: M
- **Dependencies**: feat-sdk-runtime-config (completed), feat-agent-acp-adapter (completed)
- **Parent**: feat-agent-provider
- **Children**: none
- **Created**: 2026-05-09

## Description

建立统一的 Agent Provider 抽象接口，新增 OpenClaw WebSocket 协议支持，增强现有 Hermes Agent 集成。本子 Feature 是整个 Agent Provider 系统的基础层。

**核心工作：**
1. 扩展 `AgentRuntime` trait 支持 WebSocket 协议（OpenClaw 专用）
2. 实现 OpenClaw Provider（Gateway 检测、WebSocket 连接、消息收发）
3. 增强 Hermes Provider（Skill 发现、Memory 读写、MCP 配置桥接）
4. Settings UI — Provider 选择与配置面板

## User Value Points

1. **Provider 统一切换** — Settings 中一键切换 OpenClaw / Hermes / Claude Code
2. **OpenClaw 宿主运行** — IDE 内启动并连接 OpenClaw Gateway
3. **Hermes 深度集成** — 超越基础 ACP 协议，支持 Skill/Memory/MCP

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Agent IPC Commands（需新增 WebSocket 相关）
- `neuro-syntax-ide/src/lib/useStdioAgent.ts` — Pipe/ACP 协议（需新增 WebSocket 分支）
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — Runtime 检测（需新增 OpenClaw 检测）
- `neuro-syntax-ide/src/types.ts` — 类型定义（需扩展 Provider 类型）
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — 参考实现模式

### Related Features
- `feat-universal-agent-runtime` — 通用 Stdio 通信层（已完成）
- `feat-agent-acp-adapter` — ACP 协议适配器（已完成，Hermes 基础）
- `feat-agent-pipe-adapter` — Pipe 协议适配器（已完成）
- `feat-sdk-runtime-config` — SDK 配置系统（已完成）

## Technical Solution

### 1. AgentProvider Trait 扩展（Rust）

```rust
// 现有协议扩展
enum AgentProtocol {
    Pipe,       // NDJSON stdin/stdout (Claude Code, Cursor, OpenCode)
    Acp,        // JSON-RPC 2.0 (Hermes, Codex, Kiro, Kimi, Pi)
    WebSocket,  // WebSocket JSON (OpenClaw) — NEW
}

// OpenClaw Provider
struct OpenClawProvider {
    gateway_url: String,        // default: ws://127.0.0.1:18789
    auth_token: Option<String>,
    connection: Option<WebSocket>,
}

impl OpenClawProvider {
    fn detect_installation() -> Result<RuntimeInfo>;
    fn check_gateway_health() -> Result<GatewayStatus>;
    fn spawn_gateway() -> Result<()>;
    fn connect() -> Result<()>;
    fn send_request(method: &str, params: Value) -> Result<Value>;
    fn subscribe_events() -> EventStream;
}
```

### 2. OpenClaw WebSocket Protocol

```
Tauri Backend (Rust)                    OpenClaw Gateway
    │                                        │
    │── WebSocket Connect ──────────────────→│
    │←─ {type:"res", ok:true} ─────────────│
    │                                        │
    │── {type:"req", id, method:"agent.chat",│
    │    params:{message,session}} ─────────→│
    │←─ {type:"res", id, ok, payload} ──────│
    │←─ {type:"event", event:"stream",      │
    │    payload:{delta}} ──────────────────│
    │←─ {type:"event", event:"tool_call",   │
    │    payload:{tool,input}} ─────────────│
    │                                        │
```

### 3. Hermes Enhancement

```rust
struct HermesProvider {
    // 现有 ACP 连接（已实现）
    acp_connection: AcpConnection,
    // 新增：Skill 管理
    skills_dir: PathBuf,           // ~/.hermes/skills/
    // 新增：Memory 管理
    memories_dir: PathBuf,         // ~/.hermes/memories/
    // 新增：配置桥接
    config_path: PathBuf,          // ~/.hermes/config.yaml
}

impl HermesProvider {
    fn list_skills() -> Vec<SkillInfo>;
    fn read_memory() -> String;
    fn write_memory(content: &str) -> Result<()>;
    fn get_mcp_servers() -> Vec<McpServerConfig>;
    fn set_mcp_servers(servers: Vec<McpServerConfig>) -> Result<()>;
    fn search_sessions(query: &str) -> Vec<SessionResult>;
}
```

### 4. Settings UI

```
┌─ Settings → Agent Runtime ─────────────────────┐
│                                                  │
│  Active Provider: [OpenClaw ▼]                  │
│                                                  │
│  ┌─ OpenClaw Configuration ──────────────────┐  │
│  │ Gateway URL:  ws://127.0.0.1:18789        │  │
│  │ Auth Token:   [••••••••]                  │  │
│  │ Status:       ● Connected                 │  │
│  │ Version:      openclaw@3.2.1              │  │
│  │ [Start Gateway] [Health Check]            │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Hermes Configuration ────────────────────┐  │
│  │ (when selected as active provider)        │  │
│  │ CLI Path:     /usr/local/bin/hermes       │  │
│  │ Status:       ● Available                 │  │
│  │ Skills Dir:   ~/.hermes/skills/           │  │
│  │ Memory:       [Edit MEMORY.md]            │  │
│  │ MCP Servers:  [Configure]                 │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Runtime Detection ───────────────────────┐  │
│  │ ● Claude Code  v1.0.0  (Pipe)            │  │
│  │ ● OpenClaw      v3.2.1  (WebSocket)       │  │
│  │ ● Hermes        v0.9.0  (ACP)             │  │
│  │ ○ Codex         — not installed           │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 5. IPC Commands（Tauri Backend 新增）

```rust
// OpenClaw specific
#[tauri::command]
async fn openclaw_detect() -> Result<RuntimeInfo, String>;

#[tauri::command]
async fn openclaw_gateway_start(port: u16) -> Result<(), String>;

#[tauri::command]
async fn openclaw_gateway_status() -> Result<GatewayStatus, String>;

#[tauri::command]
async fn openclaw_connect(url: String) -> Result<(), String>;

#[tauri::command]
async fn openclaw_send(id: String, method: String, params: Value) -> Result<Value, String>;

// Hermes enhancement
#[tauri::command]
async fn hermes_list_skills() -> Result<Vec<SkillInfo>, String>;

#[tauri::command]
async fn hermes_read_memory() -> Result<String, String>;

#[tauri::command]
async fn hermes_write_memory(content: String) -> Result<(), String>;

#[tauri::command]
async fn hermes_get_mcp_config() -> Result<Vec<McpServerConfig>, String>;

#[tauri::command]
async fn hermes_search_sessions(query: String) -> Result<Vec<SessionResult>, String>;
```

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在 IDE 内切换和使用不同的 Agent Provider（OpenClaw/Hermes），以便利用各框架的独特能力。

### Scenarios

#### Scenario 1: 检测已安装的 Agent
```gherkin
Given 用户已安装 OpenClaw CLI（openclaw 命令可用）
And 用户已安装 Hermes Agent（hermes 命令可用）
When 用户打开 Settings → Agent Runtime
Then 系统自动检测到两个 Agent 运行时
And 显示各自版本和状态
```

#### Scenario 2: 切换到 OpenClaw
```gherkin
Given 用户当前使用 Claude Code 作为 Agent Provider
When 用户在 Settings 中切换到 OpenClaw
Then IDE 自动检测 OpenClaw Gateway 状态
And 若 Gateway 未运行，提示启动
And 连接成功后状态指示器变为绿色
```

#### Scenario 3: OpenClaw Gateway 自动启动
```gherkin
Given 用户已选择 OpenClaw 但 Gateway 未运行
When 用户发起 Agent 对话
Then IDE 通过 Tauri 后端自动 spawn Gateway 进程
And WebSocket 连接建立后开始对话
And 对话结束后 Gateway 保持运行（不自动关闭）
```

#### Scenario 4: Hermes Skill 发现
```gherkin
Given 用户已选择 Hermes 作为 Agent Provider
And ~/.hermes/skills/ 目录下有已安装的 Skills
When 用户查看 Hermes 配置面板
Then 系统显示已安装 Skills 列表
And 每个 Skill 显示名称、描述、版本
```

#### Scenario 5: WebSocket 断连恢复
```gherkin
Given 用户正在使用 OpenClaw 进行对话
When WebSocket 连接意外断开
Then IDE 显示断连提示
And 自动尝试重连（最多 3 次）
And 重连成功后恢复对话上下文
```

### UI/Interaction Checkpoints
- Settings Agent Runtime Tab: Provider 下拉选择
- 每个 Provider 独有配置面板（动态切换）
- Runtime 状态指示器（连接中/已连接/断开/不可用）
- Gateway 启动按钮（OpenClaw 专用）
- Hermes Memory 编辑入口

### General Checklist
- OpenClaw Gateway 进程生命周期管理（启动/停止/重启）
- WebSocket 消息格式与 OpenClaw 协议完全兼容
- Hermes 增强功能不影响现有 ACP 基础通信
- Provider 切换时正确清理旧连接
- 错误处理：安装检测失败、连接超时、认证失败
