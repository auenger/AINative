# Feature: feat-agent-runtime-router 智能路由分发

## Basic Information
- **ID**: feat-agent-runtime-router
- **Name**: 智能路由分发引擎
- **Priority**: 55
- **Size**: S
- **Dependencies**: feat-agent-runtime-core
- **Parent**: feat-agent-runtime-system
- **Children**: null
- **Created**: 2026-04-03

## Description

构建智能路由分发引擎，作为 Agent Runtime 的统一入口。分析任务特征（代码生成、代码审查、需求分析、测试编写等），自动匹配最优 runtime。支持用户自定义路由规则和 fallback 策略。

## User Value Points

### VP1: 智能任务分发
提交任务时无需关心用哪个 agent，系统自动根据任务特征选择最佳 runtime，失败时自动 fallback。

## Context Analysis

### Reference Code
- `feat-agent-runtime-core` — Runtime Registry，路由器从中获取可用 runtime

### Related Documents
- 路由规则 YAML 配置格式设计

### Related Features
- feat-agent-runtime-core — 基础依赖

## Technical Solution

### Architecture
- **TaskClassifier**: Keyword-based task classifier that maps task descriptions to `TaskCategory` enum (code_generation, code_review, requirements, testing, general). Supports both Chinese and English keywords.
- **RouterEngine**: Core routing engine that takes a task description + available runtimes list, classifies the task, finds matching routing rule, selects best available runtime with fallback chain support.
- **FallbackChain**: Each `RoutingRule` has an ordered `fallback_chain` list. When the primary runtime is unavailable (not-installed/unhealthy), the engine iterates through the chain to find the first available alternative.
- **RoutingConfig**: YAML-based configuration stored at `<workspace>/.neuro/routing-config.yaml`. Contains rules array, default runtime, and default fallback chain. Loaded on workspace change, defaults used when no file exists.
- **Tauri IPC**: 4 commands (`submit_task`, `get_routing_rules`, `update_routing_rules`, `get_task_routing_decision`) + 2 events (`router://task-routed`, `router://fallback`).
- **Validation**: `update_routing_rules` validates all referenced runtime IDs against registered runtimes, returning warnings for unknown references.

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望提交任务时不需要手动选择用哪个 AI agent，系统能智能判断并自动路由到最合适的 runtime。

### Scenarios (Given/When/Then)

```gherkin
Feature: 智能路由分发

  Scenario: 根据任务类型自动选择 runtime
    Given 系统中已注册 claude-code 和 codex 两个 runtime
    And 路由规则配置: 代码生成类任务 → codex, 其他 → claude-code
    When 用户提交一个 "帮我写一个排序算法" 的代码生成任务
    Then 路由器分析任务特征，识别为 "代码生成" 类型
    And 任务被路由到 codex runtime 执行

  Scenario: Fallback 自动切换
    Given 路由器首选 codex runtime 执行代码生成
    When codex runtime 不可用（not-installed 或 unhealthy）
    Then 自动切换到备选 claude-code runtime
    And 任务成功执行
    And 日志记录 fallback 原因和路径

  Scenario: 自定义路由规则
    Given 用户定义了自定义路由规则: "所有任务优先使用 claude-code"
    When 任意任务提交
    Then 路由器按用户规则优先选择 claude-code
    And 仅在 claude-code 不可用时 fallback

  Scenario: 路由策略持久化
    Given 用户修改了路由策略
    When 策略保存
    Then 路由配置写入 YAML 文件
    And 重启后路由策略保持生效
```

### UI/Interaction Checkpoints
- 路由策略配置面板（可视化规则编辑）
- 任务提交时可查看路由决策（哪个 runtime + 原因）
- Fallback 事件通知

### General Checklist
- [x] 路由规则引擎实现
- [x] 任务分类器（基于关键词/模式匹配）
- [x] Fallback 策略链
- [x] 路由配置 YAML 持久化
- [x] Tauri IPC Commands

## Merge Record
- **Completed**: 2026-04-03
- **Merged Branch**: feature/feat-agent-runtime-router
- **Merge Commit**: 6a422ae
- **Archive Tag**: feat-agent-runtime-router-20260403
- **Conflicts**: None
- **Verification**: All 4 Gherkin scenarios passed via code analysis
- **Stats**: 3 files changed, 632 insertions
