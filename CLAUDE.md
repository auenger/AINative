# Neuro Syntax IDE — CLAUDE.md

## Agent 工作流规则（最高优先级）

> **所有 Agent（主会话 & SubAgent）必须严格遵守：**
> 执行 sub-devagent（如 `/dev-agent`、`/implement-feature` 等）相关任务时，**必须通过 Skill tool 调用对应的 skill**，**绝对不要**跳过 skill 直接实现逻辑。
> 这是强制流程，违反此规则会导致工作流状态不一致。

***

## 项目定位

Neuro Syntax IDE — AI 原生桌面端 IDE，基于 Tauri V2。

* `neuro-syntax-ide/` = React 19 + Tauri V2 桌面应用（前端 + Rust 后端）
* `feature-workflow/` = Feature 工作流引擎（队列、模板、调度）
* `features/` = Feature 实体目录（active / archive）

当前阶段: **Phase 6 — Agent Provider 生态扩展**（Phase 1–5 已完成）

***

## Tech Stack

| Layer         | Technology                                               |
| ------------- | -------------------------------------------------------- |
| Frontend      | React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4     |
| Desktop Shell | Tauri V2 (`@tauri-apps/api` v2)                           |
| Backend       | Rust (portable-pty, sysinfo, git2, notify, reqwest)      |
| IPC           | `invoke()` 调用 Command (90+) / `listen()` 接收 Event      |
| State         | `useState` + switch 视图切换（不用 React Router）           |
| Data          | FS-as-Database: YAML + Markdown（不用 SQLite）             |
| Agent Runtime | 三协议: Pipe (NDJSON) + ACP (JSON-RPC 2.0) + SDK (Sidecar) |
| AI SDK        | `@anthropic-ai/claude-agent-sdk` via Node.js Sidecar       |

***

## Agent Runtime 架构

```
┌──────────── React Frontend ────────────┐
│  useReqAgentChat / useAgentStream       │
│  useStdioAgent / useAgentRuntimes       │
└────────── IPC (invoke/listen) ──────────┘
                    │
┌──────────── Rust Backend ──────────────┐
│  AgentRuntime trait                     │
│  ├── ClaudeCodeRuntime (claude -p CLI)  │
│  ├── AgentSdkRuntime (Node.js Sidecar)  │
│  ├── StdioSessionManager                │
│  │   ├── PipeAdapter (NDJSON)           │
│  │   └── AcpAdapter (JSON-RPC 2.0)     │
│  └── RuntimeRegistry + RuntimeDetector  │
└────────────────────────────────────────┘
```

* **CLI 模式** — `claude --print --output-format stream-json`，直接子进程
* **SDK 模式** — `agent-sdk-bridge.mjs` Sidecar，通过 stdin/stdout NDJSON 通信，调用 `@anthropic-ai/claude-agent-sdk`
* **Pipe 模式** — 支持 Claude Code / Cursor / OpenCode 的 NDJSON 管道协议
* **ACP 模式** — JSON-RPC 2.0 双向通信，支持 Codex / Hermes / Kiro / Kimi / Pi
* Settings 下拉选择 Runtime 类型，路由在 `useReqAgentChat` 内切换

***

## Key Source Files

| File | Role |
|------|------|
| `neuro-syntax-ide/src/types.ts` | 全局类型定义（979 行，80+ 接口/类型） |
| `neuro-syntax-ide/src-tauri/src/lib.rs` | Rust 后端主文件（11.7k 行，90+ Tauri Commands） |
| `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` | SDK Runtime 独立模块 |
| `neuro-syntax-ide/src-tauri/src/skill_init.rs` | IDE Skill 初始化 |
| `neuro-syntax-ide/src-tauri/sidecar/agent-sdk-bridge.mjs` | Node.js Sidecar bridge |
| `neuro-syntax-ide/src/components/views/` | 24 个视图组件 |

***

## Feature Workflow

项目使用 Feature Workflow 系统管理开发流程：

* **queue.yaml** — 状态机（active / pending / blocked / completed 队列）
* **features/** — 每个 Feature 一个目录（spec.md, task.md, checklist.md）
* **features/archive/** — 已完成 Feature 归档（127 个 completed）
* **工作流 Skills** — `/new-feature`, `/start-feature`, `/implement-feature`, `/verify-feature`, `/complete-feature`
* **自动调度** — `/dev-agent`, `/run-feature` 自动驱动 Feature 开发

***

## Must Follow

* 使用 `@tauri-apps/api` **v2** 语法（非 v1）
* `cn()` 合并样式（clsx + tailwind-merge）
* 类型定义集中在 `types.ts`
* 复用原型设计系统（颜色/字体/动画），不修改
* Agent 工作流任务必须通过 Skill tool 调用，不可跳过
* 新增 Agent 协议遵循现有 `AgentRuntime` trait + `StreamEvent` 模式

## Must Avoid

* 不在前端硬编码 API Keys
* 不引入 React Router
* 不使用 SQLite
* 不在前端 mock 终端 I/O
* 不修改 Sidecar bridge 的 NDJSON 协议格式（需前后端同步）
* 不直接修改 archive 目录内容（通过 `/complete-feature` 流程归档）
