# Feature: feat-req-agent-workflow 需求分析输出工作流

## Basic Information

* **ID**: feat-req-agent-workflow

* **Name**: 需求分析输出工作流

* **Priority**: 65

* **Size**: S

* **Dependencies**: [feat-req-agent-chat]

* **Parent**: null

* **Children**: []

* **Created**: 2026-04-03

## Description

定义需求分析 Agent 的输出工作流：Agent 分析完需求后，自动通过 Claude Code 的文件工具将结构化 MD 写入项目指定目录（如 `features/` 或 `.neuro/requirements/`），与现有的 feature-workflow 系统无缝衔接。

## User Value Points

1. **一键需求文档化** — Agent 分析完需求后自动生成结构化 MD 文件到指定目录

2. **与 feature-workflow 集成** — 分析结果可以直接进入开发队列

## Context Analysis

### Reference Code

* `feature-workflow/queue.yaml` — Feature 队列结构

* `features/` 目录 — Feature 文件组织规范 (spec.md / task.md / checklist.md)

* `neuro-syntax-ide/src-tauri/src/lib.rs:1191` — `create_feature_from_agent` 现有实现

### Related Features

* feat-req-agent-bridge — CLI 桥接服务

* feat-req-agent-chat — 聊天 UI

## Technical Solution

### Agent System Prompt 设计

通过 `--system-prompt` 或 `--append-system-prompt` 注入：

```text
你是需求分析专家。当用户的需求分析完成后：

1. 使用 Glob/Read 工具了解项目现有结构
2. 使用 Write 工具将分析结果写入 features/pending-{feature-id}/ 目录
3. 遵循项目的 feature 文档规范：
   - spec.md — 需求规格（包含 Gherkin 验收标准）
   - task.md — 任务分解
   - checklist.md — 完成检查清单
4. 更新 feature-workflow/queue.yaml 的 pending 列表

输出格式必须与 /new-feature skill 生成的格式一致。
```

### 工作流

1. 用户描述需求 → Agent 多轮对话澄清

2. Agent 分析完成 → 确认要创建 feature

3. Agent 调用 Write 工具 → 创建 `features/pending-{id}/` 目录和文件

4. Agent 更新 `feature-workflow/queue.yaml`

5. 前端收到 FS 变更通知 → 刷新 feature 列表

### CLI 参数

```bash
claude --print \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt "..." \
  --allowedTools "Read Write Glob Grep Bash Edit" \
  --permission-mode acceptEdits \
  --add-dir {workspace_path}
```

### 目录结构选项

* `features/pending-{id}/` — 直接进入 feature 开发队列

* `.neuro/requirements/` — 先输出原始需求分析，再手动/自动转为 feature

## Acceptance Criteria (Gherkin)

### User Story

作为 IDE 用户，我想要需求分析完成后自动生成规范化的需求文档，以便无缝衔接后续的 feature 开发流程。

### Scenarios

```gherkin
Scenario: 需求分析完成后自动生成 Feature 文档
  Given 用户与 Agent 完成了需求讨论
  And Agent 确认了需求分析的完整性
  When Agent 调用文件写入工具
  Then 在 features/pending-{id}/ 下生成 spec.md, task.md, checklist.md
  And queue.yaml 的 pending 列表更新

Scenario: 需求分析与现有 feature 冲突
  Given 用户描述的需求与已有 feature ID 冲突
  When Agent 尝试创建 feature
  Then Agent 提示冲突并建议替代 ID

Scenario: 用户取消需求文档化
  Given 用户与 Agent 讨论需求中
  When 用户决定不继续
  Then 不创建任何文件
  And 会话保持可以继续讨论其他需求
```

### General Checklist

* [ ] Agent 输出的 MD 格式与 feature-workflow 规范一致
* [ ] queue.yaml 正确更新
* [ ] 前端 FS watcher 能检测到新 feature

## Merge Record

* **Completed:** 2026-04-03T22:00:00Z
* **Merged Branch:** feature/feat-req-agent-workflow
* **Merge Commit:** fddb225
* **Archive Tag:** feat-req-agent-workflow-20260403
* **Conflicts:** 1 (ProjectView.tsx import conflict, auto-resolved during rebase)
* **Verification:** passed (13/13 tasks, 3/3 Gherkin scenarios via code analysis)
* **Stats:** 4 files changed, 197 insertions, 2 deletions⠀