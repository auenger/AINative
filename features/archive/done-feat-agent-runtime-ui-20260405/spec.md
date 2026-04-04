# Feature: feat-agent-runtime-ui Agent 控制面板

## Basic Information
- **ID**: feat-agent-runtime-ui
- **Name**: Agent 控制面板 UI
- **Priority**: 55
- **Size**: S
- **Dependencies**: feat-agent-runtime-core, feat-agent-runtime-pipeline, feat-agent-runtime-router
- **Parent**: feat-agent-runtime-system
- **Children**: null
- **Created**: 2026-04-03

## Description

构建 Agent Runtime 系统的前端控制面板。提供可视化界面管理已检测的 runtime、创建和配置自定义 Agent（选择 runtime + 编排模式）、监控 Agent 执行过程和结果。与 Neuro Syntax IDE 的深色科幻设计系统保持一致。

## User Value Points

### VP1: 可视化 Agent 管理
通过直观的 UI 管理所有 AI agent，无需编辑配置文件。查看 runtime 状态、创建自定义 agent、监控执行过程，一站式完成。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/index.css` — 设计系统（颜色、字体、动画）
- `neuro-syntax-ide/src/components/views/MissionControl.tsx` — 仪表盘风格参考
- `neuro-syntax-ide/src/types.ts` — 类型定义
- `feat-req-agent-chat` — 已有 Agent 聊天 UI 模式

### Related Documents
- 设计系统文档（index.css）

### Related Features
- feat-agent-runtime-core — 提供 runtime 数据
- feat-agent-runtime-pipeline — 提供 pipeline 数据和操作
- feat-agent-runtime-router — 提供路由数据和操作

## Technical Solution

### Architecture
- Single `AgentControlPanel` view component with 4-tab sidebar layout (Runtimes / Agents / Executions / Routes)
- Reuses existing hooks: `useAgentRuntimes`, `usePipelineEngine`
- New hooks: `useSmartRouter` (routing config + decisions), `useAgentConfigs` (agent CRUD)
- Reuses existing `PipelinePanel` component for execution monitoring
- ViewType extended with `'agents'` in types.ts; SideNav + App.tsx updated for routing
- i18n translations added for en/zh

### Files Created
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Main view with all sub-components
- `neuro-syntax-ide/src/lib/useSmartRouter.ts` — Routing config + decisions hook
- `neuro-syntax-ide/src/lib/useAgentConfigs.ts` — Agent config CRUD hook

### Files Modified
- `neuro-syntax-ide/src/types.ts` — Added `AgentConfig`, `AgentOrchestrationMode`, extended `ViewType`
- `neuro-syntax-ide/src/App.tsx` — Added AgentControlPanel view mount
- `neuro-syntax-ide/src/components/SideNav.tsx` — Added Agents nav item
- `neuro-syntax-ide/src/i18n.ts` — Added agents translations

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望通过可视化界面管理我的 AI agent，查看它们的状态，创建自定义工作流，监控执行过程。

### Scenarios (Given/When/Then)

```gherkin
Feature: Agent 控制面板

  Scenario: 查看 Runtime 状态面板
    Given 用户打开 Agent 控制面板
    Then 显示所有已注册 runtime 的状态卡片
    And 每个卡片显示: runtime 名称、类型图标、状态灯（绿/灰/红）、版本号
    And 未安装的 runtime 显示安装引导按钮

  Scenario: 创建自定义 Agent
    Given 用户在控制面板点击 "新建 Agent"
    When 用户填写 agent 名称、选择编排模式（pipeline/route）
    And 配置对应的 runtime 和参数
    Then agent 配置保存为 YAML
    And agent 出现在可用列表中
    And 可立即用于任务提交

  Scenario: 监控 Pipeline 执行
    Given 一个 pipeline 正在执行
    When 用户查看执行面板
    Then 显示 pipeline 各 stage 的进度
    And 当前 stage 高亮并显示实时输出
    And 已完成 stage 显示勾号和耗时
    And 可暂停/恢复/终止 pipeline

  Scenario: 查看路由决策
    Given 用户通过路由提交了一个任务
    When 任务被路由到某个 runtime
    Then 控制面板显示路由决策（runtime + 分类 + 原因）
    And 若发生 fallback，显示 fallback 路径
```

### UI/Interaction Checkpoints
- 控制面板入口：SideNav 新增 Agent 图标或 EditorView 新增 Tab
- Runtime 卡片：深色玻璃态，类型图标区分（Claude 紫色、Codex 绿色）
- Agent 列表：可展开查看配置详情
- 执行面板：实时日志流 + stage 进度条
- 与现有设计系统完全一致（glass-panel、shimmer、科技蓝配色）

### General Checklist
- [x] Runtime 状态面板
- [x] Agent 创建/编辑表单
- [x] Pipeline 执行监控面板
- [x] 路由决策展示
- [x] 响应式布局
- [x] 深色主题适配

## Merge Record
- **Completed**: 2026-04-05
- **Branch**: feature/feat-agent-runtime-ui
- **Merge Commit**: 86a3ae5
- **Archive Tag**: feat-agent-runtime-ui-20260405
- **Conflicts**: None
- **Verification**: PASSED (16/16 tasks, 4/4 Gherkin scenarios)
- **Stats**: 1 commit, 7 files changed, 1286 insertions
