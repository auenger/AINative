# Feature: feat-newtask-built-in-pm New Task 内置 PM 独立 Prompt 体系

## Basic Information
- **ID**: feat-newtask-built-in-pm
- **Name**: New Task 内置 PM 独立 Prompt 体系
- **Priority**: 55
- **Size**: S
- **Dependencies**: [feat-pm-role-separation]
- **Parent**: feat-pm-newtask-role-separation
- **Children**: []
- **Created**: 2026-04-13

## Description

在 feat-pm-role-separation 完成职责分离后，为 New Task Modal 的内置 PM Agent 设计一套完全独立的 prompt 体系。

核心目标：
- 设计专用的 "Feature Creation PM" system prompt，与项目级 PM Agent 完全独立
- Prompt 应聚焦于：需求澄清 → 复杂度评估 → feature 拆分建议 → 引导创建
- 优化多轮对话策略，确保 PM Agent 能精准提取需求并生成高质量 feature plan
- Prompt 应了解 feature-workflow 体系（spec.md / task.md / checklist.md 的结构）

## User Value Points

### VP1: 更精准的需求澄清
- 内置 PM prompt 专门为 feature 创建流程优化
- 对话策略更聚焦于收集创建 feature 所需的关键信息

### VP2: 更好的 feature 质量输出
- PM Agent 理解 feature-workflow 的文档结构
- 生成的 plan 直接适配 spec.md / task.md / checklist.md 模板

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM_SYSTEM_PROMPT (L50-81)
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — New Task Modal
- `feature-workflow/templates/` — Feature 文档模板
- `.claude/skills/new-feature/skill.md` — new-feature skill 定义

### Related Documents
- `.claude/skills/new-feature/skill.md` — Feature 创建流程参考
- `feature-workflow/config.yaml` — 工作流配置

### Related Features
- feat-pm-role-separation — 前置依赖
- feat-chat-style-newtask — 已完成的多轮对话 UI

## Technical Solution

### Implementation Approach
Designed a new `FEATURE_CREATION_PM_PROMPT` constant in `useAgentChat.ts` that replaces the generic `PM_SYSTEM_PROMPT`. The new prompt is a self-contained system prompt specifically tailored for the New Task Modal's feature creation workflow.

### Key Design Decisions
1. **Completely independent constant** — New `FEATURE_CREATION_PM_PROMPT` replaces `PM_SYSTEM_PROMPT` entirely; no shared content with project-level PM Agent
2. **Feature-workflow template knowledge embedded** — The prompt explicitly describes spec.md, task.md, and checklist.md structures so the AI generates output aligned with the project's documentation system
3. **3-phase conversation strategy** — Requirement Clarification → Value Point Analysis & Complexity Assessment → Feature Plan Preparation
4. **Updated greeting message** — Changed from "I'm your PM Agent" to "I'm the Feature Creation PM" to clearly differentiate the role
5. **All references updated** — Greeting filter strings in `sendMessage()` and `generateFeaturePlan()` updated to match the new greeting text

### Files Modified
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — Replaced PM_SYSTEM_PROMPT with FEATURE_CREATION_PM_PROMPT, updated greeting, updated all greeting filter references

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 New Task 中的内置 PM Agent 有专门的对话策略来引导我澄清需求，并能生成高质量的 feature plan。

### Scenarios (Given/When/Then)

#### Scenario 1: 专用 Feature Creation Prompt
```gherkin
Given 用户在 New Task Modal 中选择 Built-in PM Agent
When 用户描述一个功能需求
Then PM Agent 使用专用的 feature creation prompt 进行需求澄清
And prompt 包含对 feature-workflow 文档结构的理解
And prompt 与项目级 PM Agent 的 prompt 完全独立
```

#### Scenario 2: 高质量 Feature Plan 生成
```gherkin
Given 用户与 New Task PM Agent 完成多轮需求澄清
When 用户点击 "Create Feature"
Then 生成的 feature plan 包含完整的价值点分析
And plan 的 task breakdown 符合 task.md 模板结构
And plan 的 acceptance criteria 符合 Gherkin 格式
```

### UI/Interaction Checkpoints
- New Task Modal chat 界面保持不变
- PM Agent 回复风格更聚焦于 feature 创建

### General Checklist
- [ ] 独立的 feature creation prompt 设计完成
- [ ] Prompt 不依赖/引用项目级 PM Agent prompt
- [ ] 生成的 feature plan 质量验证通过
