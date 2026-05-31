# Feature: feat-rig-builtin-agent Rig Built-in Agent Runtime

## Basic Information
- **ID**: feat-rig-builtin-agent
- **Name**: Rig Built-in Agent Runtime
- **Priority**: 90
- **Size**: L
- **Dependencies**: none
- **Parent**: null
- **Children**: [feat-rig-builtin-agent-core, feat-rig-builtin-agent-provider, feat-rig-builtin-agent-tools]
- **Created**: 2026-05-31

## Description
使用 [Rig](https://github.com/0xPlaygrounds/rig) (MIT License, Rust LLM 框架) 作为内置 Agent Runtime，
替代当前 `claude -p` CLI 子进程方式，实现零进程启动、直接 HTTP API 调用、Rust 原生工具执行的高性能 Agent 体验。

### 核心动机
当前 `ClaudeCodeRuntime` 每条消息都 spawn 一个新的 `claude` CLI 子进程：
- 进程启动开销 100-500ms
- 每个实例占用 50-200MB（Node.js 进程）
- 4 跳流式路径（API → Node.js → NDJSON stdout → Rust parse → Tauri Event）
- 无连接复用

Rig 作为 Rust library 直接编译进 Tauri binary：
- 启动延迟 0ms（已在进程内）
- 内存开销 ~KB（async task）
- 2 跳流式路径（API SSE → Rust Stream → Tauri Event）
- 支持 20+ LLM Provider 统一 API

## User Value Points

### VP1: 快速内置 Agent — 零进程启动的直接 LLM 调用
**用户价值**: 消息发送后立即获得响应，无 CLI 启动等待。内存占用从 MB 级降到 KB 级。
**技术路径**: 实现 `RigRuntime` trait，使用 Rig 的 Anthropic provider 直接发起 HTTP API 调用，通过 `futures::Stream` 接收 SSE 流式响应，转换为 `StreamEvent` 发送到前端。

### VP2: 多 Provider 统一 — 20+ LLM 提供商一站式接入
**用户价值**: 不再绑定 Claude，可在 Settings 中切换 OpenAI / Gemini / DeepSeek / Ollama 等任意 Provider。
**技术路径**: 利用 Rig 的统一 Provider 接口，在 Settings 中新增 Rig Provider 配置项，运行时根据配置动态创建对应 Provider 的 Client。

### VP3: IDE 工具集成 — Rust 原生工具直接操作本地文件
**用户价值**: Agent 可以直接读写项目文件、执行 Shell 命令、操作 Git，工具执行速度极快且无需外部依赖。
**技术路径**: 使用 Rig 的 `Tool` trait 实现文件读写（FileRead/FileWrite）、Shell 执行（ShellExec）、Git 操作（GitStatus/GitDiff）等工具，Agent 通过 tool_use 循环自动调用。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` L1196-1222 — `AgentRuntime` trait 定义
- `neuro-syntax-ide/src-tauri/src/lib.rs` L2706-3110 — `ClaudeCodeRuntime` 实现（被对比参照）
- `neuro-syntax-ide/src-tauri/src/lib.rs` L2477 — `RuntimeRegistry` 注册机制
- `neuro-syntax-ide/src-tauri/src/lib.rs` L3877 — `create_default_registry()` 注册点
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — SDK Runtime 独立模块（参考结构）
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — 前端 runtime 调度

### Related Documents
- [Rig GitHub](https://github.com/0xPlaygrounds/rig) — MIT, Rust LLM framework
- [Rig Documentation](https://docs.rig.rs/) — 官方文档
- [Rig Anthropic Provider](https://docs.rig.rs/docs/integrations/model_providers/anthropic)

### Related Features
- `feat-agent-sdk-runtime` — 已完成的 SDK Runtime（Sidecar 模式，参照架构）
- `feat-universal-agent-runtime` — 已完成的 Stdio 通信层（Pipe/ACP）
- `feat-agent-provider-core` (blocked) — Agent Provider 核心抽象层（可协同）

## Technical Solution

### 架构设计
```
┌──────────── React Frontend ────────────┐
│  useReqAgentChat                        │
│  (新增 "rig" runtime 选项)              │
└────────── IPC (invoke/listen) ──────────┘
                    │
┌──────────── Rust Backend ──────────────┐
│  RigRuntime (implements AgentRuntime)   │
│  ├── rig::providers::anthropic::Client  │  ← 直接 HTTP API
│  ├── rig::agent::Agent (with tools)     │  ← Agent + Tool 循环
│  ├── StreamingPrompt → StreamEvent      │  ← SSE → mpsc channel
│  └── IDE Tools (FileRead/Write/Shell)   │  ← Rust 原生执行
└────────────────────────────────────────┘
```

### 依赖管理
- `rig-core = "0.37"` — 核心 crate
- `reqwest 0.12 → 0.13` — 需升级（Rig 依赖 reqwest 0.13）
- 新增 `schemars`（JSON Schema 生成）
- 新增 `eventsource-stream`（SSE 解析）

### 拆分策略
| Sub Feature | 范围 | 依赖 |
|---|---|---|
| `feat-rig-builtin-agent-core` | RigRuntime trait 实现 + 基础流式 | 无 |
| `feat-rig-builtin-agent-provider` | Multi-Provider 配置 + Settings UI | Core |
| `feat-rig-builtin-agent-tools` | IDE Tools（文件/Shell/Git）| Core |

## Acceptance Criteria (Gherkin)

### User Story
作为一个 Neuro Syntax IDE 用户，我想要一个快速响应的内置 Agent，
使我在不安装外部 CLI 的情况下即可获得高质量的 AI 编程辅助，
且支持多种 LLM Provider 和本地文件操作能力。

### Scenarios (Given/When/Then)

#### Scenario 1: 零延迟 Agent 启动
```gherkin
Given 用户已在 Settings 配置了 API Key
And Agent Runtime 选择为 "Rig (Built-in)"
When 用户在聊天区发送消息
Then 消息应在 50ms 内开始流式响应
And 不应产生新的子进程
And 内存增量应小于 5MB
```

#### Scenario 2: 多 Provider 切换
```gherkin
Given 用户已配置 OpenAI API Key
When 用户在 Settings 切换 LLM Provider 为 OpenAI
Then Agent 应使用 GPT 模型响应
And 流式响应格式应保持一致
```

#### Scenario 3: 文件操作工具调用
```gherkin
Given Agent Runtime 为 Rig (Built-in)
And Agent 具备 FileRead/FileWrite 工具
When 用户请求 "读取 main.rs 并解释"
Then Agent 应自动调用 FileRead 工具
And 工具调用过程应在前端展示
And 读取的文件内容应作为上下文用于回答
```

### UI/Interaction Checkpoints
- Settings 页面新增 "Rig (Built-in)" Runtime 选项
- Settings 新增 Provider 配置区（Provider 选择 + API Key + Model）
- 聊天区 Runtime 下拉新增 Rig 选项
- 工具调用事件在前端渲染（复用现有 tool_use UI）

### General Checklist
- [ ] RigRuntime 实现 AgentRuntime trait
- [ ] 注册到 RuntimeRegistry
- [ ] 流式响应正确转换为 StreamEvent
- [ ] reqwest 升级到 0.13 不影响现有功能
- [ ] Multi-Provider 配置在 Settings 可用
- [ ] IDE 工具在 Agent tool_use 循环中正确执行
- [ ] 前端 Runtime 选择器包含 Rig 选项
