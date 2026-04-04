# Feature: feat-pipeline-visual-editor Pipeline 可视化拖拽编辑器

## Basic Information
- **ID**: feat-pipeline-visual-editor
- **Name**: Pipeline 可视化拖拽编辑器
- **Priority**: 80
- **Size**: M
- **Dependencies**: []
- **Parent**: feat-pipeline-editor
- **Children**: []
- **Created**: 2026-04-04

## Description
在 AgentControlPanel 的 Agents Tab 中添加 Pipeline 创建/编辑的可视化画布入口。借鉴 WorkflowEditor 的节点拖拽连线设计，每个 Stage 是一个可拖拽的节点卡片，节点间用 SVG 连线表示执行顺序。

### 核心功能
- 新建 Pipeline（输入 id / name / description）
- 添加 Stage 节点（拖拽添加到画布）
- 删除 Stage 节点
- 拖拽排序 Stage 节点位置（改变执行顺序）
- 节点间 SVG 连线自动生成（按顺序串联）
- 每个 Stage 节点的属性编辑面板：
  - `id` / `name`
  - `runtime_id`（下拉选择已发现的 runtime）
  - `prompt_template`（支持 `{{input}}` / `{{prev_output}}` 模板变量）
  - `input_mapping`（key-value 对）
  - `max_retries` / `timeout_seconds`
- 全局 `variables` 配置面板
- 保存 / 删除 Pipeline 配置
- Pipeline 列表展示 + 选择编辑

### 参考组件
- `WorkflowEditor.tsx` — 节点画布布局、SVG 连线、网格背景
- `AgentControlPanel.tsx` — AgentCreator 表单模式
- `PipelinePanel.tsx` — Stage 状态展示

## User Value Points
1. **可视化 Pipeline 构建** — 用户通过拖拽节点直观搭建多阶段 Pipeline，无需手写配置
2. **Stage 属性编辑** — 在属性面板中配置每个 Stage 的 runtime、prompt 模板、重试策略等参数

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/WorkflowEditor.tsx` — 节点拖拽画布参考
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Agent 创建入口，需在此添加 Pipeline 编辑入口
- `neuro-syntax-ide/src/components/common/PipelinePanel.tsx` — Pipeline 执行状态面板
- `neuro-syntax-ide/src/lib/usePipelineEngine.ts` — Pipeline CRUD + 执行引擎 hook
- `neuro-syntax-ide/src/types.ts` — PipelineConfig / PipelineStageConfig 类型

### Related Documents
- `module_5_ai_orchestration.md`

### Related Features
- `feat-agent-runtime-pipeline` (completed) — Pipeline 引擎后端
- `feat-agent-runtime-ui` (completed) — Agent 控制面板 UI

## Technical Solution
- Created PipelineVisualEditor component with 3-column layout: Stage template library (left), visual canvas (center), property panel (right)
- Canvas uses CSS grid background + SVG bezier curves for stage connections
- StageNodeCard supports drag-to-reposition via mouse events
- StagePropertyPanel provides form editing for all PipelineStageConfig fields
- AgentControlPanel integrated with pipeline list, "New Pipeline" button, and editor overlay mode
- Pipeline save/delete uses existing usePipelineEngine.savePipeline()/deletePipeline() hooks

### Merge Record
- **Completed**: 2026-04-05T15:00:00Z
- **Merged Branch**: feature/feat-pipeline-visual-editor
- **Merge Commit**: ceb0a95
- **Archive Tag**: feat-pipeline-visual-editor-20260405
- **Conflicts**: None (clean fast-forward merge)
- **Verification**: PASS (5/5 Gherkin scenarios verified)
- **Files Changed**: 3 (2 new, 1 modified)
- **Lines Added**: 1240

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我想在 Agent 控制面板中通过可视化拖拽方式创建和编辑 Pipeline 配置。

### Scenarios (Given/When/Then)

#### Scenario 1: 创建新 Pipeline
- Given 用户在 AgentControlPanel Agents Tab 中
- When 用户点击 "New Pipeline" 按钮
- Then 显示可视化画布，左侧显示 Stage 模板库，画布中央为空节点区域
- And 用户输入 Pipeline 名称和描述

#### Scenario 2: 添加并连接 Stage 节点
- Given 用户在 Pipeline 编辑画布中
- When 用户从左侧拖拽一个 Stage 模板到画布
- Then 画布中出现新节点卡片，自动与前一个节点用 SVG 连线连接
- And 右侧属性面板显示该 Stage 的可编辑属性

#### Scenario 3: 拖拽排序 Stage
- Given Pipeline 中有多个 Stage 节点
- When 用户拖拽节点改变位置
- Then 节点间连线自动重新生成，执行顺序随之更新

#### Scenario 4: 编辑 Stage 属性
- Given 用户选中一个 Stage 节点
- When 用户在属性面板中修改 runtime_id 或 prompt_template
- Then 配置实时更新到节点数据中

#### Scenario 5: 保存 Pipeline
- Given 用户完成 Pipeline 配置编辑
- When 用户点击 "Save Pipeline"
- Then 配置通过 `usePipelineEngine.savePipeline()` 持久化
- And Pipeline 列表中出现新条目

### UI/Interaction Checkpoints
- [ ] Pipeline 编辑入口按钮（在 Agents Tab 顶部）
- [ ] 可视化画布（网格背景 + SVG 连线）
- [ ] Stage 节点卡片（可拖拽、可选中高亮）
- [ ] 右侧属性编辑面板
- [ ] Pipeline 列表 + 编辑/删除操作
- [ ] 全局 variables 配置入口

### General Checklist
- [ ] 复用 WorkflowEditor 的画布设计风格（glass-panel、网格背景）
- [ ] 使用 cn() 合并样式
- [ ] 类型定义基于 types.ts 中已有的 PipelineConfig / PipelineStageConfig
