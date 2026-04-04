# Feature: feat-agent-runtime-system Agent Runtime 系统

## Basic Information
- **ID**: feat-agent-runtime-system
- **Name**: Agent Runtime 系统（多 Agent 编排引擎）
- **Priority**: 60
- **Size**: L
- **Dependencies**: feat-req-agent-bridge (completed)
- **Parent**: null
- **Children**: feat-agent-runtime-core, feat-agent-runtime-pipeline, feat-agent-runtime-router, feat-agent-runtime-ui
- **Created**: 2026-04-03

## Description

在 Neuro Syntax IDE 中内置 Agent Runtime 系统。Rust 后端作为 daemon 检测本地已安装的 AI coding CLI 工具（Claude Code CLI、OpenAI Codex CLI），将每个 CLI 抽象为统一的 `AgentRuntime` 接口。在此基础上支持两种编排模式：

1. **Pipeline 管道编排** — 顺序执行链，将复杂任务拆分为多个 stage，每个 stage 分配给最适合的 runtime
2. **智能路由分发** — 入口 Agent 分析任务特征，自动路由到最优 runtime 执行，支持 fallback 策略

用户可通过 YAML 配置定义自定义 Agent，组合不同 runtime 和编排策略。

## User Value Points

### VP1: Agent 发现与 Runtime 抽象
无需手动配置，IDE 启动时自动扫描并识别已安装的 AI coding CLI 工具，统一抽象为标准化 runtime 接口。用户开箱即用，零配置。

### VP2: Pipeline 管道编排
将复杂开发任务拆分为顺序执行链（如：需求分析 → 架构设计 → 代码生成 → 测试验证），每个 stage 可指定不同 runtime，stage 间自动传递上下文。

### VP3: 智能路由分发
根据任务类型（代码生成、代码审查、需求分析、测试编写等）自动匹配最优 runtime。支持 fallback：首选 runtime 不可用时自动切换备选。

### VP4: Agent 控制面板
IDE 前端提供可视化的 Agent 管理界面，展示已检测 runtime 状态、支持自定义 Agent 的创建和配置、监控 Agent 执行过程和结果。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 已有终端集成，可复用 xterm 通道
- 已完成的 `feat-req-agent-bridge` — Claude Code CLI 桥接服务，可扩展为通用 runtime
- 已完成的 `feat-req-agent-chat` — Agent 聊天 UI 模式
- `src-tauri/src/lib.rs` — Rust Commands 注册入口

### Related Documents
- `CLAUDE.md` — Phase 5: AI Agent 服务化
- `project-context.md` — Tauri IPC Contract

### Related Features
- feat-req-agent-bridge (completed) — 当前 Claude Code 桥接，需重构为通用 runtime
- feat-req-agent-workflow (completed) — 需求分析工作流，可纳入 pipeline 编排

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)

### User Story
作为一个开发者，我希望 IDE 能自动识别我安装的 AI 编码工具，并让它们协同工作，这样我可以通过统一的界面调度不同 AI agent 完成复杂开发任务。

### Scenarios (Given/When/Then)

```gherkin
Feature: Agent Runtime 系统

  Scenario: 系统启动时自动检测所有 Agent
    Given IDE 首次启动或刷新
    When 后端扫描系统 PATH 和已知安装路径
    Then 已安装的 Claude Code CLI 被注册为 "claude-code" runtime
    And 已安装的 Codex CLI 被注册为 "codex" runtime
    And 未安装的工具标记为 "not-installed" 并显示安装引导

  Scenario: 通过 Pipeline 执行多步骤任务
    Given 用户定义了 pipeline: [需求分析 → 代码生成 → 代码审查]
    And 每个 stage 绑定了对应 runtime
    When 用户提交任务触发 pipeline
    Then 系统按顺序执行，每 stage 输出传递给下一 stage
    And 最终汇总所有结果展示给用户

  Scenario: 智能路由选择最优 Runtime
    Given 系统中已注册多个可用 runtime
    When 用户提交一个代码生成类任务
    Then 路由器分析任务特征选择最优 runtime
    And 任务被分发执行并返回结果
    And 若首选 runtime 失败，自动 fallback 到备选

  Scenario: 通过控制面板管理 Agent
    Given 用户打开 Agent 控制面板
    Then 可查看所有 runtime 状态、版本、可用性
    And 可创建自定义 Agent（选择 runtime + 编排模式）
    And 可监控正在执行的 Agent 任务
```

### UI/Interaction Checkpoints
- Agent 控制面板作为 EditorView 内的新 Tab 或独立侧栏
- Runtime 状态卡片：显示名称、类型图标、状态指示灯、版本号
- Pipeline 编辑器：可视化拖拽式 stage 编排
- Agent 执行面板：实时日志、进度条、stage 切换

### General Checklist
- [ ] 支持至少 2 种 CLI Agent（Claude Code、Codex CLI）
- [ ] Runtime 接口可扩展（新增 agent 只需实现 trait）
- [ ] Pipeline 支持 stage 间上下文传递
- [ ] 路由策略可配置
- [ ] 自定义 Agent 定义持久化为 YAML
