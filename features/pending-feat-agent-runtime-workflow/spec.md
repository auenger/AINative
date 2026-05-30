# Feature: feat-agent-runtime-workflow Agent-Driven Feature Workflow

## Basic Information
- **ID**: feat-agent-runtime-workflow
- **Name**: Agent-Driven Feature Workflow — Agent 自动执行开发任务
- **Priority**: 40
- **Size**: S
- **Dependencies**: feat-agent-provider-core
- **Parent**: feat-agent-provider
- **Children**: none
- **Created**: 2026-05-09

## Description

将 Agent Provider 接入 feature-workflow 流水线，让 Agent 自动执行 `/implement-feature`、`/verify-feature` 等任务。IDE 负责任务分发、过程展示和人工审核。

**核心工作：**
1. Agent Task Bridge — 将 feature-workflow 任务转化为 Agent 可理解的指令
2. 执行监控面板 — 实时展示 Agent 执行过程
3. 结果审核 — Agent 完成后人工审核代码变更
4. 状态回写 — Agent 执行结果自动更新 queue.yaml

## User Value Points

1. **Agent 自动开发** — 将 Feature 任务委托给 Agent 执行，IDE 展示过程
2. **人工审核闭环** — Agent 完成后代码变更需人工确认后才合并

## Context Analysis

### Reference Code
- `feature-workflow/queue.yaml` — 任务队列
- `neuro-syntax-ide/src/lib/useAgentConfigs.ts` — Agent 配置（Pipeline/Routing 编排）
- `/run-feature` skill — 现有 CLI 驱动的 feature 执行流程

### Related Features
- `feat-task-scheduler` (completed) — 定时调度服务
- `feat-task-exec-button` (completed) — Task Board 执行按钮

## Technical Solution

### Agent Task Bridge

```
Feature Workflow → Agent Task Bridge → Agent Provider
                       │
                       ├─ 任务上下文组装（spec.md + task.md + project context）
                       ├─ Prompt 模板（按任务类型选择）
                       ├─ 执行超时管理
                       └─ 结果解析与状态映射
```

### 任务类型映射

| Workflow Task | Agent Prompt Template | Expected Output |
|---|---|---|
| implement-feature | 实现以下 Feature 的代码... | 代码文件变更列表 |
| verify-feature | 验证以下 Feature 是否完成... | 测试结果 + 检查清单 |
| review-spec | 审查以下 Feature 文档... | 审查意见 + 改进建议 |

### 执行监控 UI

```
┌─ Agent Execution: feat-xxx ──────────────────────┐
│ Provider: OpenClaw    Status: ● Running           │
│ Duration: 2m 34s        Turns: 12/90              │
│                                                    │
│ ┌─ Agent Log ───────────────────────────────────┐ │
│ │ [00:00] Reading spec.md...                     │ │
│ │ [00:15] Analyzing task breakdown...            │ │
│ │ [00:45] Creating component file...             │ │
│ │ [01:20] Running tests...                       │ │
│ │ [02:10] Fixing type errors...                  │ │
│ │ [02:34] ✓ All tasks completed                  │ │
│ └───────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ Changes ─────────────────────────────────────┐ │
│ │ M  src/components/NewFeature.tsx (+45, -12)   │ │
│ │ A  src/hooks/useNewFeature.ts  (+78)          │ │
│ │ M  src/types.ts (+3)                          │ │
│ └───────────────────────────────────────────────┘ │
│                                                    │
│ [View Diff] [Approve & Merge] [Reject]            │
└────────────────────────────────────────────────────┘
```

### IPC Commands

```rust
#[tauri::command]
async fn workflow_agent_execute(
    feature_id: String,
    task_type: String,  // "implement" | "verify" | "review"
    provider: String,
) -> Result<ExecutionHandle, String>;

#[tauri::command]
async fn workflow_agent_status(exec_id: String) -> Result<ExecutionStatus, String>;

#[tauri::command]
async fn workflow_agent_cancel(exec_id: String) -> Result<(), String>;

#[tauri::command]
async fn workflow_agent_approve(exec_id: String) -> Result<(), String>;

#[tauri::command]
async fn workflow_agent_reject(exec_id: String, reason: String) -> Result<(), String>;
```

## Acceptance Criteria (Gherkin)

### Scenarios

#### Scenario 1: Agent 执行 Feature 任务
```gherkin
Given Task Board 有一个 pending 状态的 Feature
When 用户点击 "Run with OpenClaw" 按钮
Then 系统组装 Feature 上下文并发送给 Agent
And 实时显示 Agent 执行日志
And Agent 完成后显示代码变更列表
```

#### Scenario 2: 人工审核
```gherkin
Given Agent 已完成 Feature 任务执行
When 用户查看变更列表并点击 "View Diff"
Then 显示完整代码变更差异
When 用户点击 "Approve & Merge"
Then 变更合并到当前分支
And queue.yaml 状态自动更新
```

#### Scenario 3: 执行失败恢复
```gherkin
Given Agent 正在执行 Feature 任务
When Agent 执行超时或出错
Then 系统显示错误信息和部分进度
And 用户可以选择 "Retry" 或 "Cancel"
And 若 Cancel，所有未提交变更被还原
```

### General Checklist
- Agent 执行过程可中断和重试
- 代码变更必须经过人工审核
- 执行结果正确回写 queue.yaml
- 超时机制防止 Agent 无限循环
