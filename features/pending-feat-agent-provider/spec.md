# Feature: feat-agent-provider Agent Provider Runtime

## Basic Information
- **ID**: feat-agent-provider
- **Name**: Agent Provider Runtime — OpenClaw / Hermes Agent 统一集成
- **Priority**: 40
- **Size**: L (split)
- **Dependencies**: feat-sdk-runtime-config (completed)
- **Parent**: null
- **Children**: feat-agent-provider-core, feat-agent-runtime-skills, feat-agent-runtime-workflow
- **Created**: 2026-05-09

## Description

将 OpenClaw 和 Hermes Agent 作为 IDE 的 Agent Provider 集成，提供统一的运行时抽象层。用户可以在 IDE 内直接使用这些 Agent 框架驱动开发，通过配置切换不同的 Agent 后端。

**背景：** 代码库已具备完善的 Agent 基础设施（`AgentRuntime` trait、Pipe/ACP 双协议、SDK Runtime Config）。Hermes 已通过 ACP 协议部分支持，OpenClaw 尚未接入。本 Feature 在现有基础上扩展，新增 OpenClaw WebSocket 协议支持，增强 Hermes 集成，并建立 Skill 生态和 Workflow 集成。

## User Value Points

1. **统一 Agent Provider 接口** — 在 Settings 中一键切换 OpenClaw / Hermes / Claude Code 等 Agent 后端，配置各自独有的参数
2. **OpenClaw Gateway 接入** — 通过 WebSocket 连接 OpenClaw Gateway，实现本地 Agent 宿主运行
3. **Hermes Agent 增强** — 深化 Hermes 集成，支持 Skill 加载、Memory 管理、MCP Server 配置
4. **Agent Skill 生态** — 浏览和安装 ClawHub（OpenClaw）及 Skills Hub（Hermes）的技能包
5. **Agent-Driven Workflow** — Agent 接入 feature-workflow，自动执行任务并汇报结果

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — 现有 Agent IPC Commands
- `neuro-syntax-ide/src/lib/useStdioAgent.ts` — Pipe/ACP 双协议实现
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — Runtime 检测与管理
- `neuro-syntax-ide/src/lib/useAgentConfigs.ts` — Agent 配置管理
- `neuro-syntax-ide/src/types.ts` — Agent 类型定义
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — SDK Runtime 实现

### Related Documents
- OpenClaw: WebSocket JSON protocol, Gateway 架构, Skills/Plugins 系统
- Hermes Agent: ACP JSON-RPC 2.0, Skill 自学习, MCP Server 支持

### Related Features
- `feat-universal-agent-runtime` (completed) — 通用 Agent Runtime Stdio 通信层
- `feat-agent-acp-adapter` (completed) — ACP JSON-RPC 2.0 Adapter
- `feat-agent-pipe-adapter` (completed) — NDJSON Pipe Adapter
- `feat-sdk-runtime-config` (completed) — SDK Runtime 独立配置

## Technical Solution

### 架构概览

```
┌─────────────────────────────────────────────────┐
│                Neuro Syntax IDE                  │
├─────────────────────────────────────────────────┤
│              Agent Provider Manager              │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  OpenClaw   │ │  Hermes  │ │ Claude Code  │  │
│  │  Provider   │ │ Provider │ │   Provider   │  │
│  │ (WebSocket) │ │  (ACP)   │ │   (Pipe)     │  │
│  └──────┬──────┘ └────┬─────┘ └──────┬───────┘  │
│         └───────┬─────┘              │           │
│          AgentRuntime Trait          │           │
├─────────────────────────────────────────────────┤
│              Tauri Rust Backend                  │
│  ┌──────────────────────────────────────────┐   │
│  │        Agent Process Manager              │   │
│  │  (spawn / health / session / destroy)     │   │
│  └──────────────────────────────────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐ │
│  │ WebSocket  │ │   ACP      │ │  NDJSON     │ │
│  │  Client    │ │ JSON-RPC   │ │  Pipe       │ │
│  └────────────┘ └────────────┘ └─────────────┘ │
├─────────────────────────────────────────────────┤
│          External Agent Processes                │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐│
│  │ OpenClaw │  │  Hermes   │  │ Claude Code   ││
│  │ Gateway  │  │  Agent    │  │    CLI        ││
│  └──────────┘  └───────────┘  └───────────────┘│
└─────────────────────────────────────────────────┘
```

### 新增 Provider 类型

```typescript
type AgentProviderType =
  | 'claude-code'    // Pipe — Claude Code CLI
  | 'agent-sdk'      // Sidecar — Claude Agent SDK
  | 'openclaw'       // WebSocket — OpenClaw Gateway
  | 'hermes'         // ACP — Hermes Agent
  | 'codex'          // ACP — OpenAI Codex
  | 'kiro'           // ACP — Kiro
  | 'kimi'           // ACP — Kimi
  | 'pi';            // ACP — Pi
```

### OpenClaw Provider（新增）

**协议：** WebSocket JSON（与现有 Pipe/ACP 并列的第三种协议）

```
连接流程:
1. 检测 openclaw CLI 是否安装 → `which openclaw`
2. 检测 Gateway 是否运行 → WebSocket ping :18789
3. 若未运行 → spawn Gateway 进程（`openclaw gateway --port 18789`）
4. 建立 WebSocket 连接 → 握手认证
5. 通过 req/res + event 模式通信

消息格式:
→ Request:  {type:"req", id, method, params}
← Response: {type:"res", id, ok, payload|error}
← Event:    {type:"event", event, payload, seq}
```

### Hermes Provider（增强）

**现有：** ACP JSON-RPC 2.0 协议已实现
**增强：**
- Skill 目录发现与加载（`~/.hermes/skills/`）
- Memory 文件读写（`~/.hermes/memories/MEMORY.md`、`USER.md`）
- MCP Server 配置桥接（`~/.hermes/config.yaml` → IDE Settings）
- Session 历史搜索（SQLite FTS5 → `~/.hermes/state.db`）

### Skill 生态桥接

```
ClawHub (OpenClaw)  → openclaw skills install/list
Skills Hub (Hermes) → hermes skills install/list
```

IDE 提供：
- Skill 浏览 UI（分类、搜索、安装）
- 已安装 Skill 管理
- Skill 配置编辑

### Workflow 集成

```
Feature Queue → Agent Provider → Agent 执行 → 结果回写
     │                              │
     │  /implement-feature          │  代码变更
     │  /verify-feature             │  测试结果
     │  /review-spec                │  审查报告
```

Agent 作为 feature-workflow 的执行引擎，替代当前 CLI 驱动模式。

## Acceptance Criteria (Gherkin)

### User Story
作为一个开发者，我希望在 IDE 内使用 OpenClaw 或 Hermes Agent 驱动开发，以便利用这些框架的自主 Agent 能力提升开发效率。

### Scenarios

#### Scenario 1: 切换 Agent Provider
```gherkin
Given IDE 已启动且 Settings 页面打开
When 用户在 Agent Runtime 设置中选择 "OpenClaw" 或 "Hermes"
Then IDE 自动检测对应 Agent 是否已安装
And 若已安装，显示运行时状态（版本、健康状态）
And 若未安装，显示安装引导提示
```

#### Scenario 2: OpenClaw Gateway 连接
```gherkin
Given 用户已选择 OpenClaw 作为 Agent Provider
When 用户发起 Agent 对话
Then IDE 通过 WebSocket 连接 OpenClaw Gateway
And 消息通过 req/res 协议收发
And 实时流式显示 Agent 响应
```

#### Scenario 3: Hermes Skill 自学习
```gherkin
Given 用户已选择 Hermes 作为 Agent Provider
When Agent 在对话中创建新 Skill
Then IDE 显示新 Skill 创建通知
And Skill 列表自动刷新
And 用户可以在 Skill 管理面板查看和编辑
```

#### Scenario 4: Agent 执行 Feature 任务
```gherkin
Given Task Board 有 pending 状态的任务
When 用户点击 "Run with Agent" 按钮
Then 系统使用当前选定的 Agent Provider 执行任务
And 实时显示 Agent 执行过程
And 执行完成后自动更新任务状态
```

### UI/Interaction Checkpoints
- Settings → Agent Runtime → Provider 下拉选择
- Provider 配置面板（每个 Provider 独有参数）
- Runtime 状态指示器（健康/离线/忙碌）
- Skill 管理面板（浏览/搜索/安装/配置）
- Agent 执行输出面板（流式渲染）

### General Checklist
- 支持 OpenClaw Gateway 自动检测与启动
- 支持 Hermes Agent CLI 检测与配置
- 统一的 Provider 抽象接口，新增 Provider 只需实现 trait
- Skill 生态双向桥接（ClawHub + Skills Hub）
- Agent 执行结果正确回写到 feature-workflow
