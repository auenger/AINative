# Feature: feat-settings-workflow-config Settings 工作流参数配置

## Basic Information
- **ID**: feat-settings-workflow-config
- **Name**: Settings 工作流参数配置
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-27

## Description
在 Settings 页面中增加 Workflow 配置区，允许用户通过 UI 直接调整 `feature-workflow/config.yaml` 中的工作流参数，包括并行开发数量、自动化启动策略、Git 推送行为、归档标签创建、worktree/分支清理策略等。避免用户手动编辑 YAML 文件。

## User Value Points
1. **并行与自动化配置** — 用户可在 Settings UI 中控制 `max_concurrent`、`auto_start`、`auto_start_next` 等参数，灵活调整开发工作流的并行度和自动化级别
2. **完成与清理行为配置** — 用户可控制 feature 完成后的归档标签创建、worktree/分支自动清理、自动推送等行为，适配不同工作习惯

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/SettingsView.tsx` — 当前 Settings 页面（General / LLM Providers / Profile 三个 Tab）
- `neuro-syntax-ide/src/lib/useSettings.ts` — Settings 持久化 Hook（Tauri FS + localStorage fallback）
- `neuro-syntax-ide/src/types.ts` — 类型定义（AppConfig / AppSettings）
- `feature-workflow/config.yaml` — 目标配置文件

### Related Documents
- CLAUDE.md — 项目技术栈和约束

### Related Features
- feat-settings-style-unify（已完成）— Settings 页面样式统一

## Technical Solution

### 方案概述
在 SettingsView 中新增第四个 Tab **"Workflow"**，用于展示和编辑 config.yaml 中的工作流参数。

### 配置参数分组

**Group 1: 并行与自动化（Parallelism & Automation）**
| Key | Type | Default | UI Control |
|-----|------|---------|------------|
| `parallelism.max_concurrent` | number | 1 | 数字输入（1-5） |
| `workflow.auto_start` | boolean | false | Toggle 开关 |
| `workflow.auto_start_next` | boolean | true | Toggle 开关 |

**Group 2: Git 行为（Git Behavior）**
| Key | Type | Default | UI Control |
|-----|------|---------|------------|
| `git.auto_push` | boolean | false | Toggle 开关 |
| `git.push_tags` | boolean | true | Toggle 开关 |

**Group 3: 归档与清理（Completion & Cleanup）**
| Key | Type | Default | UI Control |
|-----|------|---------|------------|
| `completion.archive.create_tag` | boolean | true | Toggle 开关 |
| `completion.cleanup.delete_worktree` | boolean | true | Toggle 开关 |
| `completion.cleanup.delete_branch` | boolean | true | Toggle 开关 |

### 数据流
1. 读取 `feature-workflow/config.yaml` → 解析为 WorkflowConfig 对象
2. UI 编辑 → 更新内存状态 + dirty 标记
3. 保存 → 写回 `feature-workflow/config.yaml`（YAML 序列化）
4. 通过 Tauri FS API 实现文件读写，dev 模式下使用 localStorage 模拟

### 类型定义
```typescript
interface WorkflowConfig {
  parallelism: {
    max_concurrent: number;
  };
  workflow: {
    auto_start: boolean;
    auto_start_next: boolean;
  };
  git: {
    auto_push: boolean;
    push_tags: boolean;
  };
  completion: {
    archive: { create_tag: boolean };
    cleanup: { delete_worktree: boolean; delete_branch: boolean };
  };
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望在 Settings 界面中直接调整工作流配置参数（并行数、自动启动、清理策略等），而不需要手动编辑 YAML 文件。

### Scenarios (Given/When/Then)

#### Scenario 1: 查看 Workflow 配置
```gherkin
Given 用户打开 Settings 页面
When 用户点击 "Workflow" Tab
Then 页面显示三个配置分组：并行与自动化、Git 行为、归档与清理
And 每个参数的值与 config.yaml 当前值一致
```

#### Scenario 2: 修改并行数并保存
```gherkin
Given 用户在 Workflow Tab 页面
When 用户将 "最大并行数" 从 1 改为 3 并点击保存
Then config.yaml 中 parallelism.max_concurrent 更新为 3
And 页面显示保存成功提示
And 保存按钮恢复禁用状态
```

#### Scenario 3: 切换自动启动并取消
```gherkin
Given 用户在 Workflow Tab 页面
And workflow.auto_start 当前为 false
When 用户将 "自动启动" 切换为 true
Then 保存按钮变为可用状态（dirty）
When 用户点击重置按钮
Then 自动启动恢复为 false
And 保存按钮恢复禁用状态
```

#### Scenario 4: 并行数边界验证
```gherkin
Given 用户在 Workflow Tab 页面
When 用户尝试将 "最大并行数" 输入为 0 或负数
Then 输入被限制为最小值 1
When 用户尝试将 "最大并行数" 输入为大于 5
Then 输入被限制为最大值 5
```

### UI/Interaction Checkpoints
- Workflow Tab 在 SettingsView 中与 General / LLM Providers / Profile 并列
- Toggle 开关样式与现有 General Tab 中 auto-refresh 开关保持一致
- 数字输入使用 +/- 按钮或滑块，带 min/max 限制
- 保存/重置按钮行为与现有 LLM Providers Tab 一致
- 未保存变更时切换 Tab 或关闭 Settings 需提示（dirty state）

### General Checklist
- [ ] 不引入新依赖（使用现有 YAML 解析库或手写简单解析）
- [ ] 复用现有 useSettings Hook 模式
- [ ] 暗色/亮色主题适配
- [ ] 响应式布局
