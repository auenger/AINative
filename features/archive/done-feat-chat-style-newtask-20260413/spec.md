# Feature: feat-chat-style-newtask Chat-style NewTask Modal

## Basic Information
- **ID**: feat-chat-style-newtask
- **Name**: Chat-style NewTask Modal（需求多轮对话 + 精准触达 new-feature）
- **Priority**: 60
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-13

## Description

将 NewTaskModal 的 Step 2（需求输入）从单一 textarea 改造为多轮对话面板，让用户通过 Chat 方式逐步描述需求。PM Agent 主动追问模糊点、协商拆分方案、确认 Gherkin 场景，对话充分后一键触发 new-feature 创建。

核心目标：提升需求准确率，降低自动化执行出错率。把"设计"和"执行"分离 — 设计阶段在 Modal 内多轮 Chat 打磨需求，执行阶段保持 DevSubAgent 全自动。

## User Value Points

1. **多轮需求对话** — 用户可以通过 Chat 逐步描述需求，PM Agent 主动追问关键细节（搜索范围、交互方式、边界条件等），而非一次性提交模糊描述
2. **需求拆分协商** — AI 识别复杂度后，用户可以在对话中调整拆分粒度（合并/拆分 value points），协商确认后再创建
3. **对话上下文传递** — 多轮对话的完整上下文（messages 数组）作为 prompt 传给 `generateFeaturePlan()`，确保生成的 spec/task/Gherkin 基于充分澄清的需求

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — 当前 Modal 实现，4 步 wizard
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent chat hook，已有 `sendMessage()` + `messages` + streaming
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Agent 管理面板
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — Markdown 渲染组件

### Related Documents
- `project-context.md` — 项目架构和代码规范
- `.claude/skills/new-feature/skill.md` — new-feature skill 定义

### Related Features
- `feat-modal-drag-resize` — Modal 拖拽/调整大小（已完成）
- `feat-new-task-runtime-execute` — New Task Runtime 执行（已完成）
- `feat-agent-conversation` — Feature Detail Agent 对话区（已完成）

## Technical Solution

### 前端改动（主要）

**1. NewTaskModal.tsx — Step 2 改造**

将 `step === 'input-requirement'` 从 textarea 改为 chat 面板：

```
┌─────────────────────────────────────────────┐
│ Create New Feature                    [x]   │
│ Step: Chat Requirement ← [Agent] [Chat] [✓]│
├─────────────────────────────────────────────┤
│ 🤖 PM Agent:                                │
│ 你好！请描述你想要的功能...                   │
│                                             │
│ 👤 你:                                      │
│ 我想做一个文件搜索功能                       │
│                                             │
│ 🤖 PM Agent:                                │
│ 好的，几个问题帮你明确：                     │
│ 1. 搜索范围？ 2. 需要正则吗？               │
│                                             │
│ ┌──────────────────────────────┐ [📎] [Send]│
│ │ 继续描述你的需求...           │            │
│ └──────────────────────────────┘            │
├─────────────────────────────────────────────┤
│  [Cancel]          [✨ Create Feature]       │
└─────────────────────────────────────────────┘
```

核心 UI 元素：
- 消息气泡列表（user/assistant 交替）
- 底部输入框 + Send 按钮
- "Create Feature" 按钮（对话充分后激活）
- 流式输出（复用 `agent://chunk` listener）

**2. useAgentChat.ts — PM_SYSTEM_PROMPT 增强**

更新 system prompt 增加对话引导能力：
- 如果用户描述模糊，主动追问关键细节
- 讨论拆分方案，让用户确认
- 当信息充分时，建议创建 feature 并等待用户确认

**3. generateFeaturePlan 改造**

当前 `generateFeaturePlan(description: string)` 只接受单条文本，需要改为接受 `messages: ChatMessage[]`，将完整对话上下文传给后端。

### 后端改动（Rust）

**4. agent_generate_feature_plan Command 增强**

接受 `messages` 数组而非单条 `description`，让 AI 基于完整对话历史生成 plan。

### 两条路径 UX 差异

- **PM Agent（内置）** → Modal 内 chat 面板多轮对话 → 生成 plan → createFeature
- **Claude Code（外部 runtime）** → 保持现有行为，直接发 `/new-feature` 给 CLI

## Acceptance Criteria (Gherkin)

### User Story
作为一个用户，我希望在创建新 Feature 时能通过对话方式逐步描述需求，而不是一次性写完所有内容，这样我可以更准确地表达我的意图。

### Scenarios (Given/When/Then)

#### Scenario 1: 多轮需求澄清
```gherkin
Given 用户打开了 NewTaskModal 并选择了 PM Agent
When 用户输入简短需求描述 "我想做个搜索功能"
Then PM Agent 应追问至少 1 个澄清问题（如搜索范围、匹配方式等）
And 用户可以继续输入补充信息
And 对话历史在面板中滚动显示
```

#### Scenario 2: 流式输出显示
```gherkin
Given 用户已发送一条消息
When PM Agent 正在生成回复
Then 回复应以流式方式逐字显示在消息气泡中
And 发送按钮和输入框应显示 loading 状态
```

#### Scenario 3: 对话上下文传递到 Plan 生成
```gherkin
Given 用户与 PM Agent 已完成 3 轮以上对话
When 用户点击 "Create Feature" 按钮
Then generateFeaturePlan 应接收完整 messages 数组
And 生成的 Feature Plan 应反映对话中讨论的所有细节
```

#### Scenario 4: Create Feature 按钮状态
```gherkin
Given 用户刚开始对话
Then "Create Feature" 按钮应可见但为 disabled 状态
When 用户与 PM Agent 至少完成 1 轮对话
Then "Create Feature" 按钮变为 enabled 状态
```

#### Scenario 5: 外部 Runtime 路径不变
```gherkin
Given 用户选择了 Claude Code 或 Codex 外部 runtime
When 进入 Step 2
Then 应显示原有的 textarea 输入模式（非 chat 面板）
And 点击 Create 后直接发送 /new-feature 命令给 runtime
```

#### Scenario 6: 对话历史与 Modal 状态管理
```gherkin
Given 用户正在 chat 面板中与 PM Agent 对话
When 用户关闭 Modal 后重新打开
Then 对话历史应被清空，回到 Step 1（选择 Agent）
And 之前的 feature 创建状态也应重置
```

### UI/Interaction Checkpoints
- [ ] Chat 面板消息气泡样式区分 user/assistant（参考设计系统配色）
- [ ] 流式输出有打字效果（cursor blink）
- [ ] 消息区域自动滚动到底部
- [ ] 输入框支持 Enter 发送、Shift+Enter 换行
- [ ] Modal 拖拽和调整大小功能不受影响

### General Checklist
- [x] 不引入新的依赖（复用 useAgentChat 现有能力）
- [x] 不修改设计系统（颜色/字体/动画）
- [x] 不引入 React Router
- [x] 使用 Tauri V2 API 语法

## Merge Record
- **Completed**: 2026-04-13T17:00:00Z
- **Merged Branch**: feature/feat-chat-style-newtask
- **Merge Commit**: 01af9cc
- **Archive Tag**: feat-chat-style-newtask-20260413
- **Conflicts**: 2 files (checklist.md, task.md) -- auto-resolved (feature branch version kept)
- **Verification**: PASS (6/6 Gherkin scenarios, 21/21 tasks, TS check clean)
- **Development Stats**:
  - Duration: ~1 hour
  - Commits: 2 (implementation + evidence)
  - Files changed: 2 source files (useAgentChat.ts, NewTaskModal.tsx)
