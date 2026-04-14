# Feature: feat-pm-role-separation PM Agent 职责分离与 Prompt 拆分

## Basic Information
- **ID**: feat-pm-role-separation
- **Name**: PM Agent 职责分离与 Prompt 拆分
- **Priority**: 60
- **Size**: M
- **Dependencies**: []
- **Parent**: feat-pm-newtask-role-separation
- **Children**: []
- **Created**: 2026-04-13

## Description

将当前混用的 PM Agent 职责拆分为两个独立角色：

1. **项目 PM Agent**（ProjectView）— 聚焦纯需求分析与讨论，不再承担 feature 创建能力
2. **New Task 内置 PM**（NewTaskModal）— 专属 feature 创建流程的多轮对话引导

核心变更：
- ProjectView 的 PM Agent prompt 重新设计：纯需求分析、架构讨论、上下文维护
- 移除 ProjectView 中 `generateFeaturePlan()` 和 `createFeature()` 的调用入口
- ProjectView PM Agent 的定位从 "Context Architect + Feature Creator" 变为 "Requirement Analyst"
- New Task 内置 PM 的 prompt 保持独立，专注需求澄清 → feature 创建流程

## User Value Points

### VP1: 清晰的 PM Agent 职责边界
- 项目 PM Agent 只做需求分析，用户不会被混淆的功能按钮误导
- 需要创建 feature 时，统一通过 New Task Modal 入口

### VP2: 更专注的需求分析体验
- ProjectView PM Agent 的 prompt 可以更深度地引导需求讨论
- 不再混入 feature 创建的技术细节

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM Agent 聊天区（L269-283 systemPrompt，L706-728 generateFeaturePlan/createFeature）
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent hook（PM_SYSTEM_PROMPT L50-81）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — New Task Modal（使用 useAgentChat）

### Related Documents
- `.claude/skills/pm-agent/skill.md` — Claude Code skill 层面的 PM Agent 定义
- `project-context.md` — 项目上下文知识库

### Related Features
- feat-chat-style-newtask — 已完成的 chat-style NewTask Modal
- feat-pm-agent-provider-switch — PM Agent 提供商切换
- feat-new-task-runtime-execute — New Task runtime 执行

## Technical Solution

### Changes Made

**File: `neuro-syntax-ide/src/components/views/ProjectView.tsx`**

1. **PM Agent system prompt redesigned** (lines ~269-295):
   - Replaced "Context Architect + Feature Creator" prompt with "Requirement Analyst" prompt
   - New prompt explicitly forbids feature creation and redirects users to New Task button
   - Focuses on requirement clarification, probing questions, and structured analysis

2. **PM Agent greeting message updated**:
   - Old: "Hello! I'm your PM Agent. I'll help you define and maintain the project context. What are we building today?"
   - New: "Hello! I'm your Requirement Analyst. I'll help you explore and refine your project ideas through focused discussion. Tell me — what are you thinking about building?"

3. **PM Agent subtitle updated**:
   - Changed from "Context Architect" to "Requirement Analyst" in the PM Agent tab header

4. **Removed Generate Tasks button** from header toolbar (was next to Git Status button)

5. **Removed Task Generation Modal** (entire modal ~140 lines) including:
   - Generate Tasks initial state with spinner
   - Feature plan display with priority/size badges
   - Task group breakdown view
   - Create Feature / Discard buttons

6. **Removed handler functions**:
   - `handleGenerateTasks()` — called `pmAgent.generateFeaturePlan()`
   - `handleCreateFeature()` — called `pmAgent.createFeature()`

7. **Removed state variables**:
   - `showTaskModal` state
   - `isGenerating` state
   - `generatedPlan` state

8. **Cleaned up unused imports**:
   - `FeaturePlanOutput` type import
   - `Layers` icon import
   - `Plus` icon import

### What Was NOT Changed

- `useAgentStream.ts` — `generateFeaturePlan` and `createFeature` remain in the hook (used by other consumers like NewTaskModal)
- `NewTaskModal.tsx` — completely untouched, its built-in PM and runtime paths work independently
- REQ Agent tab — no changes to the Requirements Agent functionality

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望项目 PM Agent 只做需求分析和讨论，创建 feature 统一通过 New Task 入口，这样职责清晰不会混淆。

### Scenarios (Given/When/Then)

#### Scenario 1: ProjectView PM Agent 纯需求分析
```gherkin
Given 用户在 ProjectView 中与 PM Agent 对话
When 用户描述一个功能需求
Then PM Agent 应该只进行需求澄清和讨论
And 不应主动触发 feature 创建流程
And 不应显示 "Generate Tasks" 或 "Create Feature" 按钮
```

#### Scenario 2: PM Agent 建议用户通过 New Task 创建 Feature
```gherkin
Given 用户在 ProjectView PM Agent 中完成了需求讨论
When 需求已经足够清晰可以创建 feature
Then PM Agent 可以建议用户 "点击 New Task 按钮来创建正式的 Feature"
And PM Agent 不自己执行 feature 创建
```

#### Scenario 3: New Task Modal 仍然可以创建 Feature
```gherkin
Given 用户打开 New Task Modal
When 用户选择 Built-in PM Agent 并完成多轮对话
Then 可以正常点击 "Create Feature" 生成 feature plan 并创建
```

### UI/Interaction Checkpoints
- ProjectView PM Agent 区域：移除 Generate Tasks / Create Feature 按钮
- ProjectView PM Agent prompt：更新为纯需求分析导向
- New Task Modal：行为不变，保持现有的多轮对话 + Create Feature 流程

### General Checklist
- [x] ProjectView PM Agent prompt 更新
- [x] 移除 ProjectView 中的 feature 创建相关按钮和逻辑
- [x] New Task Modal 功能不受影响
- [x] 现有 feature 创建流程完整性测试通过

## Merge Record

- **Completed**: 2026-04-14T12:00:00Z
- **Merged branch**: feature/feat-pm-role-separation
- **Merge commit**: 9995894
- **Archive tag**: feat-pm-role-separation-20260414
- **Conflicts**: None
- **Verification**: 3/3 Gherkin scenarios passed
- **Stats**: 2 commits, 1 file changed, 30 insertions, 202 deletions
