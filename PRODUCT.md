## Neuro Syntax IDE — AI 原生工程开发平台

> **把 Claude Code、Codex、OpenCode 这些 Coding Agent 统一接入 IDE，用 FDD 工作流驱动它们干活。**\
> **不需要懂终端，不需要 vibe coding，打开 IDE 就是工程级开发流程。**

***

### 一句话

Neuro Syntax IDE 是一款内嵌 **FDD 工作流引擎** 的 AI 原生桌面 IDE。它将 Claude Code、Codex、OpenCode、Hermes 等主流 Coding Agent 统一集成为 Runtime Agent，通过 Feature-Driven Development 工作流自动编排需求分析、规格设计、代码实现、验证交付的全流程。

***

### 解决什么问题

今天的 AI 编程工具已经很强了——Claude Code 能写代码，Codex 能建项目，OpenCode 能改 bug。但现实是：

* **普通人用不了**——你得装终端、配环境、记命令行参数，非技术人员根本无从下手

* **Vibe Coding 不可控**——跟 AI 聊天写代码，没有规格、没有验证、没有归档，全凭感觉

* **Agent 各自为战**——Claude Code 用 CLI，Codex 用 API，协议不同，无法统一管理

* **没有工程流程**——缺依赖管理、缺上下文传播、缺版本追溯，交付质量靠运气

Neuro Syntax IDE 把这些问题一次性解决了：**Agent 统一接入，工作流内嵌 IDE，FDD 方法论驱动整个开发过程。**

***

### 三层核心能力

#### 1. Agent Runtime — 主流 Coding Agent 统一接入

一套 `AgentRuntime` trait 接口，四种通信协议并行运行：

| 协议                 | 模式         | 支持的 Agent                           |
| ------------------ | ---------- | ----------------------------------- |
| CLI Pipe           | NDJSON 子进程 | Claude Code (`claude -p`)           |
| SDK Sidecar        | Node.js 桥接 | Claude Agent SDK (绕过 CLI 限流)        |
| Pipe (NDJSON)      | Stdio 管道   | Claude Code, Cursor Agent, OpenCode |
| ACP (JSON-RPC 2.0) | 双向 RPC     | Codex, Hermes, Kiro, Kimi, Pi       |

Settings 一键切换 Agent 后端，前端代码无需改动。你的开发不绑定任何单一 Agent 供应商。

#### 2. Feature Workflow — FDD 驱动的工程流程

内嵌的工作流引擎以 **Feature-Driven Development** 为设计思想，把"跟 AI 聊天写代码"变成"按工程流程交付特性"：

```text
FDD 五阶段              Feature-Workflow 对应
─────────────────     ──────────────────────────────
1. Build Overall Model  →  /init-project + project-context.md
2. Build Features List  →  /new-feature + /split-feature
3. Plan by Feature      →  queue.yaml 依赖排序 + 优先级
4. Design by Feature    →  spec.md 技术方案 + task.md 任务拆解
5. Build by Feature     →  /implement-feature + /verify-feature
```

**不是 vibe coding，是工程级 harness：**

* 每个特性有完整规格（spec.md）——需求、技术方案、验收标准

* 每个特性有任务拆解（task.md）——拆成 2-5 分钟的原子任务

* 每个特性有验收检查（checklist.md）——Gherkin 场景验证

* 依赖关系显式建模（queue.yaml DAG）——前置特性先完成，上下文自动传播

* Git worktree 物理隔离——每个特性独立分支、独立文件系统，互不干扰

* 归档即知识积累——完成的特性归档到 archive，下次开发可以回溯参考

**垂直切片，不是水平分层：**

传统开发按技术层分工（前端组、后端组、DBA 组），FDD 按业务特性垂直切——一个特性从数据层到 UI 层端到端跑通。AI Agent 天然适合这种方式，一个 Agent 同时覆盖所有技术层，不存在技术筒仓问题。

#### 3. IDE 壳子 — 工作流内嵌，开箱即用

工作流不是终端命令行里的插件，是直接嵌入 IDE 的原生功能：

* **Task Board** — 可视化看板，拖拽管理特性状态，支持搜索、排序、定时调度

* **New Task Modal** — 多轮对话创建需求，AI 自动生成 spec/task/checklist

* **Agent Tab** — Feature Detail 里的 Agent 对话区，Review/Modify/Develop 三种模式

* **Runtime Monitor** — 实时监控 Agent 进程状态，Session 输出持久化

* **Settings** — Agent 类型选择、LLM Provider 配置、Workflow 参数调节

* **Pixel Agent Observatory** — 像素小人可视化展示 Agent 实时行为

**非技术人员不再需要知道终端 Coding Agent 的细节问题。** 打开 IDE，描述你想做什么，工作流自动驱动 Agent 完成。

***

### 127 个特性实证

这款 IDE 的第一个真实项目，就是用它自己开发自己。127 个 Feature 全部由 Agent 通过工作流自动交付——需求分析、规格输出、代码实现、验证归档，完整的软件工程周期。

这不是概念验证，是 **Agent 自己造自己的工程实证**。每一个归档特性都有完整的 spec、task、checklist、验证记录，可追溯、可回滚、可审计。

***

### 与主流框架的关系

Feature-Workflow 汲取了当前 AI Coding 工作流领域的优秀实践：

| 框架          | 我们借鉴了什么                                 |
| ----------- | --------------------------------------- |
| OpenSpec    | 规范先行、构建前共识、propose→apply→archive 流程     |
| BMad Method | 多角色分工、规模自适应、PM/Architect/Developer 角色分离 |
| Superpowers | TDD 流程、worktree 隔离、子代理架构、证据优于声明         |
| EvoDev 论文   | Feature Map DAG、三层上下文传播、依赖关系驱动开发        |

并在这些基础上，以 **FDD 为核心方法论**，构建了完整的工程实践。

***

### 技术底座

* **Tauri V2 + React 19** — 桌面级性能，Web 级开发效率

* **Rust 后端** — portable-pty 真终端、sysinfo 硬件探针、git2 版本管控、notify 文件监听

* **三协议 Runtime** — Pipe / ACP / SDK，一套 trait，多种 Agent 后端

* **FS-as-Database** — YAML + Markdown 即数据库，Git 天然版本管控

* **Feature Workflow Plugin** — 15 个原子 Skill 可组合，SubAgent 独立 200k context

***

### 一句话总结

**Neuro Syntax IDE 把主流 Coding Agent 统一接入了 IDE，用 FDD 工作流把 AI 编程从 vibe coding 推向了工程级交付。** 工作流直接内嵌在 IDE 里，非技术人员不需要知道终端和 Coding Agent 的细节。127 个自我交付的特性证明：FDD 驱动的 AI Coding，不只是聊天写代码——是真正可工程化的软件开发方式。

⠀