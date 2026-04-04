# Tasks: feat-agent-runtime-ui

## Task Breakdown

### 1. 前端 — 类型定义
- [x] `types.ts` 新增 Agent Runtime 相关类型（AgentConfig, AgentOrchestrationMode）+ ViewType 扩展
- [x] IPC 调用封装（useSmartRouter.ts, useAgentConfigs.ts）

### 2. 前端 — Runtime 状态面板
- [x] `RuntimeCard` 组件（名称、图标、状态灯、版本、操作按钮）
- [x] `RuntimeList` 组件（网格布局，展示所有 runtime）
- [x] 安装引导组件（未安装时显示安装命令 + 复制按钮）

### 3. 前端 — Agent 创建/编辑
- [x] `AgentCreator` 表单组件（名称、编排模式选择、runtime 选择、参数配置）
- [x] `AgentList` 组件（可用 agent 列表）— 通过 AgentListItem 实现
- [x] `AgentDetail` 组件（查看 agent 配置详情）— 通过 expandable AgentListItem 实现

### 4. 前端 — Pipeline 执行监控
- [x] `PipelineMonitor` 组件（stage 进度可视化）— 复用 PipelinePanel
- [x] `StageCard` 组件（状态、实时输出、耗时）— PipelinePanel 内 StageRow
- [x] 执行控制按钮（暂停/恢复/终止/重试）— PipelinePanel 内置

### 5. 前端 — 路由决策展示
- [x] `RoutingInfo` 组件（显示路由决策和 fallback 路径）— RoutingDecisionCard
- [x] 路由策略配置面板 — RoutingRuleEditor

### 6. 前端 — 控制面板容器
- [x] `AgentControlPanel` 主视图组件
- [x] Tab 切换：Runtime | Agents | Executions | Routes
- [x] 接入 SideNav + App.tsx 路由 + i18n 翻译

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature created |
| 2026-04-05 | Implemented | All tasks completed |
