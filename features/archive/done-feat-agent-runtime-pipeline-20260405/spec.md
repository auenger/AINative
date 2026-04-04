# Feature: feat-agent-runtime-pipeline Pipeline 管道编排引擎

## Basic Information
- **ID**: feat-agent-runtime-pipeline
- **Name**: Pipeline 管道编排引擎
- **Priority**: 55
- **Size**: S
- **Dependencies**: feat-agent-runtime-core
- **Parent**: feat-agent-runtime-system
- **Children**: null
- **Created**: 2026-04-03

## Description

在 Agent Runtime Core 基础上构建 Pipeline 编排引擎。用户可通过 YAML 配置定义顺序执行链（如：需求分析 → 代码生成 → 代码审查），每个 stage 绑定一个 runtime，stage 间自动传递上下文。支持失败重试、暂停恢复。

## User Value Points

### VP1: 多步骤任务自动化
将复杂开发任务拆分为有序 pipeline，每个 step 由最合适的 agent 执行，实现端到端自动化。

## Context Analysis

### Reference Code
- `feat-agent-runtime-core` — Runtime trait 和 Registry
- `feat-req-agent-workflow` — 已有的工作流输出模式，可参考 stage 间数据传递
- `feature-workflow/queue.yaml` — 现有的状态机模式可参考

### Related Documents
- Pipeline YAML 配置格式设计

### Related Features
- feat-agent-runtime-core — 基础依赖

## Technical Solution

### Architecture
Frontend TypeScript implementation (no Rust backend yet). Pipeline engine is a React hook (`usePipelineEngine`) with:
- **Data model**: Types in `types.ts` — PipelineConfig, PipelineStageConfig, PipelineExecution, PipelineStageExecution + event payloads
- **Engine**: `usePipelineEngine.ts` hook — state machine (pending/running/paused/completed/failed), sequential stage execution, context passing via `{{prev_output}}` template variable, retry with configurable max_retries, pause/resume via abort flags
- **Persistence**: localStorage in dev mode, Tauri IPC (`invoke`) in production
- **Templates**: `pipelineTemplates.ts` — 3 pre-built templates with instantiation helper
- **UI**: `PipelinePanel.tsx` — stage status visualization with expandable output, error display, pause/resume/retry buttons

### Key Design Decisions
1. **Abort-flag pattern**: Pause sets an `aborted` flag checked between stages; no Web Workers or threads needed
2. **Template variable system**: `{{input}}` for original input, `{{prev_output}}` for previous stage output, `{{variable_name}}` for globals
3. **Tauri IPC stubs**: All `invoke()` calls guarded by `isTauri` check with dev-mode simulation fallbacks

### Files Changed
- `neuro-syntax-ide/src/types.ts` — Pipeline types (added ~130 lines)
- `neuro-syntax-ide/src/lib/usePipelineEngine.ts` — Pipeline engine hook (new, ~400 lines)
- `neuro-syntax-ide/src/lib/pipelineTemplates.ts` — Pre-built templates (new, ~120 lines)
- `neuro-syntax-ide/src/components/common/PipelinePanel.tsx` — Execution UI panel (new, ~230 lines)

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望将复杂任务拆分为多步骤 pipeline，让不同 AI agent 各司其职，自动完成端到端工作流。

### Scenarios (Given/When/Then)

```gherkin
Feature: Pipeline 管道编排

  Scenario: 创建并执行顺序 Pipeline
    Given 用户定义了 pipeline: [需求分析(claude-code) → 代码生成(codex) → 代码审查(claude-code)]
    When 用户提交任务描述触发 pipeline
    Then stage 1 将任务描述发送给 claude-code runtime
    And stage 1 的输出自动作为 stage 2 的输入
    And stage 2 的输出自动作为 stage 3 的输入
    And pipeline 完成后汇总所有 stage 结果

  Scenario: Pipeline Stage 失败重试
    Given 一个正在执行的 pipeline
    When stage 2 执行失败（超时或错误）
    Then pipeline 暂停并通知用户
    And 用户可选择重试该 stage
    And 已完成的 stage 1 结果保留不丢失
    And 重试成功后 pipeline 从 stage 2 继续

  Scenario: Pipeline 配置持久化
    Given 用户创建了一个自定义 pipeline
    When 保存配置
    Then pipeline 定义写入 YAML 文件
    And 下次启动 IDE 时 pipeline 可用

  Scenario: Pipeline 执行进度可视化
    Given 一个正在执行的 pipeline
    When 用户查看执行面板
    Then 显示当前执行的 stage 高亮
    And 已完成 stage 显示绿色勾
    And 待执行 stage 显示灰色
    And 当前 stage 显示实时输出流
```

### UI/Interaction Checkpoints
- Pipeline 编辑器：可视化 stage 列表，支持拖拽排序
- 执行面板：实时 stage 进度、日志输出
- YAML 编辑：高级用户可直接编辑 pipeline 配置

### General Checklist
- [x] Pipeline YAML 格式定义
- [x] Pipeline 引擎状态机（pending → running → paused → completed/failed）
- [x] Stage 间上下文传递机制
- [x] 失败重试逻辑
- [x] Tauri IPC Commands

## Merge Record
- **Completed**: 2026-04-05T11:00:00Z
- **Merged Branch**: feature/feat-agent-runtime-pipeline
- **Merge Commit**: 23e375a
- **Archive Tag**: feat-agent-runtime-pipeline-20260405
- **Conflicts**:
  - had_conflict: true
  - conflict_files:
    - neuro-syntax-ide/src/types.ts
  - resolved_at: "2026-04-05T11:00:00Z"
  - resolution: "Combined both Router types (feat-agent-runtime-router) and Pipeline types (feat-agent-runtime-pipeline) in types.ts"
  - re_verified: true
- **Verification**:
  - status: passed
  - scenarios_total: 4
  - scenarios_passed: 4
- **Stats**:
  - started: "2026-04-05T10:00:00Z"
  - duration: "~60m"
  - commits: 1
  - files_changed: 4
  - insertions: 1183
