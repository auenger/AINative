# Feature: feat-rig-builtin-agent-core Rig Core — AgentRuntime 实现 + 流式

## Basic Information
- **ID**: feat-rig-builtin-agent-core
- **Name**: Rig Core — AgentRuntime 实现 + 基础流式
- **Priority**: 90
- **Size**: S
- **Dependencies**: none
- **Parent**: feat-rig-builtin-agent
- **Children**: null
- **Created**: 2026-05-31

## Description
实现 `RigRuntime` struct，作为 `AgentRuntime` trait 的第五个实现。
使用 Rig 的 Anthropic provider 直接发起 HTTP API 调用，
通过 `futures::Stream` 接收 SSE 流式响应，转换为 `StreamEvent` 推送到前端。

这是整个 Rig Built-in Agent 的核心基础层，提供：
- 零进程启动的 LLM 调用
- 直接 SSE 流式响应（2 跳 vs 当前 4 跳）
- 与现有 RuntimeRegistry 无缝集成
- 初始仅支持 Anthropic Claude 模型

## User Value Points

### VP1: 零延迟 Agent 响应
消息发送后直接在 Tauri 进程内发起 HTTP API 调用，无 CLI 子进程启动开销。
流式路径从 4 跳缩减为 2 跳：API SSE → Rust Stream → Tauri Event。

## Context Analysis

### Reference Code
- `lib.rs:1196-1222` — `AgentRuntime` trait（需实现）
- `lib.rs:2706-3110` — `ClaudeCodeRuntime`（参考实现，对比性能差距）
- `lib.rs:2477` — `RuntimeRegistry`（注册机制）
- `lib.rs:3877` — `create_default_registry()`（注册点）
- `lib.rs:1162` — `ExecuteParams`（输入参数）
- `lib.rs:1177` — `StreamEvent`（输出事件）
- `agent_sdk_runtime.rs` — 独立模块参考（文件组织模式）

### Related Documents
- [Rig Anthropic Provider Docs](https://docs.rig.rs/docs/integrations/model_providers/anthropic)
- [Rig Streaming API](https://docs.rs/rig-core/0.37.0/rig_core/streaming/index.html)
- [Rig Agent Builder](https://docs.rs/rig-core/0.37.0/rig_core/agent/index.html)

### Related Features
- `feat-agent-sdk-runtime` (completed) — SDK Runtime 模块结构参考
- `feat-universal-agent-runtime` (completed) — AgentRuntime trait 定义

## Technical Solution

### 1. 依赖升级
```toml
# Cargo.toml 修改
[dependencies]
rig-core = "0.37"
# reqwest 0.12 → 0.13 (Rig 依赖)
reqwest = { version = "0.13", features = ["json", "stream"] }
```

### 2. 新文件: `src-tauri/src/rig_runtime.rs`
```rust
pub struct RigRuntime {
    // Anthropic client (lazy init)
}

impl AgentRuntime for RigRuntime {
    fn id(&self) -> &str { "rig" }
    fn name(&self) -> &str { "Rig (Built-in)" }
    fn runtime_type(&self) -> &str { "builtin" }
    fn capabilities(&self) -> Vec<AgentCapability> {
        vec![Streaming, ToolUse, Sessions]
    }
    fn detect(&self) -> Result<Option<(String, String)>, String> {
        // Built-in, always available (no external binary needed)
        Ok(Some(("builtin".into(), "0.1.0".into())))
    }
    fn execute(&self, params: ExecuteParams) -> Result<mpsc::Receiver<StreamEvent>, String> {
        // 1. Get or create Rig Anthropic client
        // 2. Build Agent with preamble (system_prompt)
        // 3. stream_prompt() -> futures::Stream
        // 4. Spawn tokio task to iterate stream -> send StreamEvent via mpsc
    }
}
```

### 3. 流式转换
```rust
// SSE chunk → StreamEvent mapping
match streamed_content {
    StreamedAssistantContent::Text(text) => {
        StreamEvent { text: text.delta, msg_type: "assistant", is_done: false, .. }
    }
    StreamedAssistantContent::ToolCall(tool_call) => {
        StreamEvent { msg_type: "tool_use", text: serialize(tool_call), .. }
    }
    // stream end
    _ => StreamEvent { is_done: true, .. }
}
```

### 4. 注册
```rust
// lib.rs create_default_registry()
registry.register(Box::new(rig_runtime::RigRuntime::new()));
```

### 5. API Key 管理
- 从 `.neuro/settings.yaml` 读取 `rig.anthropic_api_key`
- 若未配置，使用环境变量 `ANTHROPIC_API_KEY`
- 若都无，返回 `NotInstalled` 状态并提示配置

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我想要选择 Rig 作为 Agent Runtime，
以获得比 claude -p 更快的响应速度和更低的内存占用。

### Scenarios

#### Scenario 1: Rig Runtime 可用
```gherkin
Given 用户已配置 Anthropic API Key
When 用户打开 Settings 查看 Runtime 列表
Then 应显示 "Rig (Built-in)" 状态为 Available
And 不需要安装任何外部 CLI
```

#### Scenario 2: 流式聊天
```gherkin
Given 用户选择 "Rig (Built-in)" 作为 Runtime
When 用户发送 "Hello"
Then 应在 50ms 内开始收到流式文本
And 文本应逐 token 流入
And 最终收到 is_done = true 事件
```

#### Scenario 3: 未配置 API Key
```gherkin
Given 用户未配置 Anthropic API Key
And 环境变量 ANTHROPIC_API_KEY 未设置
When 系统扫描 Runtime
Then Rig Runtime 状态应为 NotInstalled
And 提示信息应引导用户配置 API Key
```

### General Checklist
- [x] `rig_runtime.rs` 模块文件创建
- [x] `RigRuntime` 实现 `AgentRuntime` trait 全部方法
- [x] 流式响应正确转换为 `StreamEvent`
- [x] 注册到 `RuntimeRegistry`
- [x] ~~`Cargo.toml` 添加 `rig-core` 依赖~~ 决策变更：不引入 rig-core，直接用 reqwest 0.12 HTTP SSE
- [x] ~~`reqwest` 升级到 0.13~~ 不升级，避免版本冲突
- [x] API Key 从 settings.yaml 读取（Anthropic provider + env fallback）
- [x] 前端 Runtime 下拉新增 "Rig (Built-in)" 选项

## Merge Record
- **Completed**: 2026-05-31T14:35:00Z
- **Merged Branch**: feature/feat-rig-builtin-agent-core
- **Merge Commit**: dc232b3
- **Archive Tag**: feat-rig-builtin-agent-core-20260531
- **Conflicts**: none
- **Verification**: PASS (3/3 Gherkin scenarios verified at code level)
- **Stats**: 1 commit, 3 files changed, 456 insertions(+), duration ~35min
