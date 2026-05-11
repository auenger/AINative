# Feature: feat-newtask-dialog-adaptive

## Basic Information
- **ID**: feat-newtask-dialog-adaptive
- **Name**: NewTask Modal 多轮对话自适应布局与富内容渲染
- **Priority**: 75
- **Size**: M
- **Dependencies**: feat-chat-panel-md-resize (设计参考)
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-08

## Description

优化 NewTaskModal 多轮对话弹窗的布局自适应性及内容渲染能力，解决三个核心体验问题：

1. **对话区域高度自适应** — 当前消息列表区域使用固定 `max-h-[320px]`，无论弹窗如何拖拽调整大小，消息区域高度始终不变，造成空间浪费或内容被截断。需要让消息区域高度跟随弹窗实际可用高度动态变化。
2. **输入框跟随弹窗底部浮动** — 当前输入区域虽然位于底部，但在弹窗 resize 后未正确贴底。需要确保输入框始终固定在弹窗内容区最底部，弹窗缩放时输入框随之移动。
3. **多轮对话内容 Markdown + 工具调用渲染** — 当前多轮对话中 assistant 消息的渲染效果有限，需要支持完整的 Markdown 渲染（代码块、表格、列表等）以及 Claude Code 工具调用事件的可视化展示。

## User Value Points

1. **自适应布局体验** — 弹窗拖拽调整大小后，对话区域自动填充可用空间，输入框始终贴底，用户无需手动滚动查看被截断的内容
2. **富内容可读性** — 多轮对话中的 Markdown 内容（标题、列表、代码块、表格）和工具调用事件（tool call / tool result）均以结构化、美观的方式渲染

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — NewTask 弹窗主组件
  - 消息区域 `max-h-[320px]` 固定高度限制
  - 输入区域 textarea `min-h-[36px] max-h-[80px]`
  - 弹窗尺寸 `width: 680px`, `minHeight: 400px`, `resize: 'both'`
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Agent 对话面板参考实现
  - PM Agent / REQ Agent 的对话布局模式
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — 已有的完整 Markdown 渲染组件（GFM 支持）
- `features/pending-feat-chat-panel-md-resize/spec.md` — Agent 对话面板 Markdown + resize 优化（设计参考，同类实现模式）

### Related Documents
- `feat-chat-panel-md-resize` 是针对 ProjectView 对话面板的同类优化，本 feature 将类似方案应用到 NewTaskModal 弹窗场景
- `feat-file-tree-resizable` (已完成) — 拖拽 resize 实现模式参考

### Related Features
- `feat-chat-panel-md-resize` (pending) — Agent 对话窗口 MD 渲染 + 面板 resize，设计模式完全可复用
- `feat-agent-tool-ui` (已完成) — Agent 工具事件 UI 渲染
- `feat-chat-style-newtask` (已完成) — Chat-style NewTask Modal 基础实现

## Technical Solution

### 1. 对话区域高度自适应
- 移除消息列表的固定 `max-h-[320px]` 限制
- 将弹窗内容区改为 flex 布局：`flex flex-col h-full`
- 消息列表区域：`flex-1 overflow-y-auto`，自动填充除输入区外的所有剩余空间
- 弹窗容器需正确传递高度给内容区（通过 `h-full` 级联或 `calc()` 计算）

### 2. 输入框底部浮动
- 输入区域使用 `shrink-0` 固定在 flex 容器底部
- 确保弹窗 resize 后 flex 布局正确重算，输入框始终贴底
- 消息区域和输入区域之间可添加适当的 padding/border 分隔

### 3. Markdown + 工具调用渲染
- 将 NewTaskModal 中多轮对话的 assistant 消息渲染替换为 `MarkdownRenderer` 组件
- 复用 `feat-agent-tool-ui` 和 `feat-chat-panel-md-resize` 中的工具调用渲染模式
- 工具调用消息（tool_call / tool_result）使用结构化 UI 展示（展开/折叠、状态图标等）

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 NewTask 弹窗的多轮对话区域能自适应弹窗大小，输入框始终贴底，且对话内容能以美观的 Markdown 格式和结构化的工具调用展示呈现。

### Scenarios (Given/When/Then)

#### Scenario 1: 对话区域高度自适应
```gherkin
Given 用户打开了 NewTask Modal
When 用户通过拖拽将弹窗高度增大
Then 对话消息区域的高度应随弹窗增大而自动扩展
And 消息内容不应被截断或需要不必要的滚动
And 消息区域应正确显示滚动条（当消息超出可视区域时）
```

#### Scenario 2: 对话区域高度缩小
```gherkin
Given 用户打开了 NewTask Modal 且弹窗处于较大尺寸
When 用户通过拖拽将弹窗高度缩小
Then 对话消息区域的高度应随弹窗缩小而自动收缩
And 输入框应始终保持在弹窗底部
And 弹窗不应小于 minHeight 约束
```

#### Scenario 3: 输入框始终贴底
```gherkin
Given 用户正在 NewTask Modal 中进行多轮对话
When 弹窗经过任意 resize 操作后
Then 输入框应始终固定在弹窗内容区的最底部
And 输入框不应随消息滚动而移动
```

#### Scenario 4: Assistant 消息 Markdown 渲染
```gherkin
Given 用户在 NewTask Modal 中与 Agent 进行多轮对话
When Agent 返回包含标题、列表、代码块、表格的 Markdown 内容
Then 这些 Markdown 元素应正确渲染为对应的格式
And 代码块应有暗色背景和等宽字体
And 渲染效果应与 ProjectView 对话面板一致
```

#### Scenario 5: 工具调用事件渲染
```gherkin
Given Agent 在多轮对话中执行了工具调用
When 工具调用消息（tool_call）和工具结果（tool_result）出现在对话中
Then 工具调用应以结构化 UI 展示（工具名称、状态图标、可展开/折叠）
And 工具结果内容也应支持 Markdown 渲染
```

### UI/Interaction Checkpoints
- 弹窗 resize 时对话区域平滑过渡，无闪烁或抖动
- 消息列表自动滚动到底部（新消息到达时）
- Markdown 渲染不影响流式输出的打字机效果
- 工具调用 UI 与 ProjectView 中保持视觉一致性

### General Checklist
- [x] 不影响现有 NewTask 弹窗功能（agent 选择、需求输入、执行、结果预览）
- [x] 不引入新的 layout overflow 问题
- [x] Markdown 渲染组件复用已有的 MarkdownRenderer
- [x] 工具调用渲染复用已有模式，保持视觉一致性

## Merge Record

- **completed_at**: '2026-05-11T12:30:00Z'
- **merged_branch**: feature/feat-newtask-dialog-adaptive
- **merge_commit**: (merge commit on main)
- **archive_tag**: feat-newtask-dialog-adaptive-20260511
- **conflicts**: none
- **verification_status**: passed
- **development_stats**:
  - started: '2026-05-11T12:00:00Z'
  - duration: ~30min
  - commits: 1
  - files_changed: 1 (NewTaskModal.tsx)
