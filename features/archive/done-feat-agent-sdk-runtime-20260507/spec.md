# Feature: feat-agent-sdk-runtime Claude Agent SDK Runtime

## Basic Information
- **ID**: feat-agent-sdk-runtime
- **Name**: Claude Agent SDK Runtime（新增 SDK 模式替代 claude -p）
- **Priority**: 92
- **Size**: M
- **Dependencies**: feat-agent-stdio-core
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-07

## Description

GLM 模型方检测到 `claude -p` CLI 调用，认为是非法使用 Coding Plan 模式并做了限制（api retry → 429）。
需要新增一个 AgentSdkRuntime，通过 Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）的 Node.js sidecar 方式调用，
绕过 `claude -p` 的检测。

**核心策略**: 保留现有 ClaudeCodeRuntime，新增 AgentSdkRuntime 作为独立选项，用户在 Settings 中选择。

## Scope

**IN**:
- 新增 `AgentSdkRuntime` struct（独立 Rust 模块 `agent_sdk_runtime.rs`）+ Node.js sidecar 脚本
- Settings 页面 Runtime 类型切换 UI（claude-cli / agent-sdk 下拉）
- NDJSON stdin/stdout 通信协议（含容错设计）
- 基本错误处理（Provider 不兼容、Key 无效、网络错误、sidecar 崩溃、rate limit）
- 复用现有 Provider 配置体系（api_base + api_key + model），不新增独立 SDK 配置区

**OUT**:
- 不修改现有 ClaudeCodeRuntime 代码
- 不修改 AgentRuntime trait 定义（只实现它）
- 不涉及 PM Agent / REQ Agent prompt 逻辑
- 不修改现有前端 Hook 签名（在 useReqAgentChat 内部路由 runtime 类型）
- 不支持 `protocol: "openai"` 的 Provider 直连（需 Anthropic Messages API 格式）
- 打包方案仅做 macOS 验证，Windows/Linux 为后续独立 feature

## User Value Points

### VP1: REQ Agent 恢复可用
- 通过 SDK 模式绕过 GLM 对 `claude -p` 的限制
- Agent 正常工作，不再出现 api retry → 429 错误
- 支持流式输出、多轮对话、session 管理

### VP2: Settings Runtime 模式切换
- Settings 页面新增 SDK Runtime 配置选项
- 用户可在 claude -p（ClaudeCodeRuntime）和 SDK（AgentSdkRuntime）之间切换
- SDK 模式复用当前 Provider 配置（api_base + api_key + model），要求 `protocol: "anthropic"`
- 兼容任何 Anthropic Messages API 格式的端点（Anthropic 官方、LiteLLM、DeepSeek Anthropic、vLLM 等）

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — ClaudeCodeRuntime 实现（`--print` 方式）+ AgentRuntime trait 定义 + StreamEvent 结构
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — 前端 Runtime 管理器
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — REQ Agent 的 React Hook

### Related Documents
- [Claude Agent SDK Overview](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [Claude Agent SDK TypeScript Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/typescript)
- [Yume: Tauri + React + Claude Code SDK 参考实现](https://github.com/aofp/yume)

### Related Features
- feat-agent-stdio-core — Agent Stdio 通信核心抽象层
- feat-agent-pipe-adapter — NDJSON Pipe Adapter（Claude Code）
- feat-claude-code-runtime-monitor — Claude Code Runtime 状态监听

## Technical Solution

### 架构方案: Node.js Sidecar

```
┌──────────────────────────────────────────────┐
│  Tauri App (Rust)                            │
│                                              │
│  ┌─────────────┐    IPC     ┌──────────────┐ │
│  │  React 前端  │ ◄───────► │ Rust Backend │ │
│  │  (WebView)  │  invoke/  │              │ │
│  │             │  listen   │ AgentSdk     │ │
│  └─────────────┘           │ Runtime      │ │
│                            │      │       │ │
│                            │      │ spawn │ │
│                            │      ▼       │ │
│                            │ ┌──────────┐ │ │
│                            │ │Node.js   │ │ │
│                            │ │Sidecar   │ │ │
│                            │ │(SDK调用)  │ │ │
│                            │ └──────────┘ │ │
│                            └──────────────┘ │
└──────────────────────────────────────────────┘
```

### Sidecar 脚本 (`src-tauri/sidecar/agent-sdk-bridge.mjs`)

Node.js 脚本，通过 stdin/stdout NDJSON 与 Rust 通信：
- 接收: `{ type: "query" | "interrupt" | "close", ...params }`
- 发送: `{ type: "assistant" | "result" | "error" | "rate_limit", ...data }`
- 使用 `@anthropic-ai/claude-agent-sdk` 的 `query()` async generator

**NDJSON 容错规则**（吸取 feat-agent-pipe-adapter 教训）：
- 非法 JSON 行 → 发送 `{ type: "error", subtype: "malformed_input", raw: line }` 而非静默丢弃
- Sidecar 启动 banner / 非 JSON 输出 → 写入 stderr（不经过 stdout NDJSON 通道）
- Rust 端解析时跳过空行和 UTF-8 BOM，解析失败的事件记入 debug 日志

### Rust 端 (`AgentSdkRuntime`)

代码组织：**独立模块** `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs`（不堆积到 lib.rs），lib.rs 仅保留 `mod agent_sdk_runtime;` 声明和 runtime 注册。

实现 `AgentRuntime` trait：
- `execute()` → spawn sidecar 进程，桥接 stdout → `mpsc::channel<StreamEvent>`
- `runtime_type()` → `"agent-sdk"`
- 支持 session 管理（resume/fork）
- 支持 `startup()` 预热（app 启动时可选）

**运行时监控兼容**：现有 `feat-claude-code-runtime-monitor` 的 sysinfo 进程扫描匹配 "claude"/"claude-code" 规则。SDK sidecar 进程名为 `node ...agent-sdk-bridge.mjs`，需在 `agent_sdk_runtime.rs` 中提供 `info()` 返回进程 PID，供监控器扩展识别（不修改现有监控器代码，仅暴露接口）。

### Provider 配置注入

SDK Runtime 复用现有 Settings Provider 体系，sidecar spawn 时从当前激活 Provider 注入配置：

```rust
// AgentSdkRuntime::execute() 伪代码
let provider = get_active_provider_from_settings()?;  // 读取 settings.yaml
if provider.protocol != "anthropic" {
    return Err("SDK 模式要求 Provider 协议为 anthropic，请切换或新增一个 Anthropic 兼容的 Provider");
}
let env = hashmap!{
    "ANTHROPIC_BASE_URL" => provider.api_base,
    "ANTHROPIC_API_KEY"  => provider.api_key,
};
let model = settings.llm.model.clone();
// → sidecar query({ prompt, options: { model, env } })
```

SDK 支持的注入参数（来自 `@anthropic-ai/claude-agent-sdk`）：

| 参数 | 来源 | 用途 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | `provider.api_base` | 连接 Anthropic 兼容端点 |
| `ANTHROPIC_API_KEY` | `provider.api_key` | X-Api-Key 认证 |
| `ANTHROPIC_AUTH_TOKEN` | 如需 Bearer 认证 | Authorization: Bearer 认证 |
| `options.model` | `llm.model` | 指定模型 |

前端 Settings 页面新增：
- Runtime 类型选择：`claude-cli` | `agent-sdk`
- 当选择 `agent-sdk` 且当前 Provider `protocol !== "anthropic"` 时，显示兼容性提示

### 关键 API 映射

| SDK 概念 | Rust StreamEvent 映射 |
|----------|----------------------|
| `SDKMessage.type === "assistant"` | `{ text: content, msg_type: "assistant" }` |
| `SDKMessage.type === "result"` | `{ is_done: true, text: result }` |
| `SDKMessage.type === "stream_event"` | `{ text: partial, msg_type: "stream" }` |
| `SDKMessage.type === "rate_limit_event"` | `{ msg_type: "rate_limit", ...info }` |
| `SDKMessage.type === "system"` | `{ msg_type: "system", session_id }` |

## Acceptance Criteria (Gherkin)

### User Story
作为一个 Neuro Syntax IDE 用户，我希望使用 Claude Agent SDK 模式运行 Agent，
以便绕过 GLM 模型方对 `claude -p` 的限制，正常使用 REQ Agent 功能。

### Scenarios (Given/When/Then)

#### Scenario 1: SDK Runtime 正常调用
```gherkin
Given 用户在 Settings 中选择了 "Agent SDK" runtime 模式
And 当前激活 Provider 的 protocol 为 "anthropic"
And 已配置有效的 api_key 和 api_base
When 用户在 REQ Agent 中发送一条消息
Then Agent 通过 SDK sidecar 正常响应
And 响应以流式方式实时显示在聊天区
And 不出现 api retry 或 429 错误
```

#### Scenario 2: SDK Runtime 多轮对话
```gherkin
Given 用户使用 SDK runtime 完成了一次对话
When 用户发送第二条消息（继续对话）
Then SDK 使用 session resume 继续上下文
And 第二轮回复保持上下文连贯
```

#### Scenario 3: SDK Runtime 错误处理 — Provider 不兼容
```gherkin
Given 用户在 Settings 中选择了 "Agent SDK" runtime 模式
And 当前激活 Provider 的 protocol 为 "openai"（非 anthropic）
When 用户尝试发送消息
Then 显示清晰的错误提示："SDK 模式要求 Anthropic 兼容的 Provider，请在 Settings 中切换或新增 protocol=anthropic 的 Provider"
And 不会 spawn sidecar 进程
```

#### Scenario 3b: SDK Runtime 错误处理 — API Key 无效
```gherkin
Given 用户在 Settings 中选择了 "Agent SDK" runtime 模式
And 当前 Provider protocol 为 "anthropic" 但 api_key 无效
When 用户尝试发送消息
Then sidecar spawn 后 SDK 返回认证错误
And 前端显示 "API Key 无效，请检查 Provider 配置" 错误提示
```

#### Scenario 4: Runtime 模式切换
```gherkin
Given 用户当前使用 claude -p runtime
When 用户在 Settings 中切换到 "Agent SDK" 模式
Then 后续 Agent 调用使用 SDK 模式
And 切换过程无需重启 App
And 原有的 claude -p runtime 仍可切换回去
```

#### Scenario 5: Sidecar 进程异常退出恢复
```gherkin
Given 用户使用 SDK runtime，sidecar 正在流式输出响应
When Node.js sidecar 进程意外退出（OOM / 未捕获异常）
Then Rust 端在 2 秒内检测到进程退出
And 发送 { msg_type: "error", text: "Agent 运行时异常退出" } 事件
And 前端显示内联错误提示（非弹窗）
And 活跃会话标记为 error 状态，不无限等待
And 用户可重试发送消息（自动 respawn sidecar）
```

#### Scenario 6: Runtime 切换时有活跃会话
```gherkin
Given 用户使用 SDK runtime 有一个正在进行的对话
When 用户在 Settings 中切换到 "claude -p" 模式
Then 系统检测到活跃会话，发送优雅关闭信号到 sidecar
And sidecar 停止后切换到 claude -p runtime
And 后续消息使用新 runtime，不保留旧会话上下文
```

#### Scenario 7: 用户中断 SDK Agent 执行
```gherkin
Given SDK sidecar 正在流式输出
When 用户点击停止按钮
Then Rust 端发送 { type: "interrupt" } 命令到 sidecar stdin
And sidecar 调用 SDK 取消当前 query，输出 { type: "result", is_done: true }
And 前端显示已中断状态（"已停止"标记）
```

### UI/Interaction Checkpoints
- Settings 页面新增 Runtime 类型下拉选择器
- 选择 agent-sdk 时显示 Provider 兼容性状态（当前 Provider 是否 protocol: anthropic）
- 不兼容时显示引导提示（"切换到 Anthropic 兼容 Provider" 或 "新增 Provider"）
- Sidecar 进程状态指示器（running/stopped/error）
- 错误状态内联提示（非弹窗）

### General Checklist
- [ ] sidecar 进程生命周期管理（启动/停止/异常恢复）
- [ ] 流式输出实时渲染
- [ ] Provider 配置正确注入到 sidecar 环境变量
- [ ] Sidecar 打包到 Tauri bundle
