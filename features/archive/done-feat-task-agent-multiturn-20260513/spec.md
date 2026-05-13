# Feature: feat-task-agent-multiturn

## Basic Information
- **ID**: feat-task-agent-multiturn
- **Name**: Task Detail Agent Tab 多轮对话与富内容渲染
- **Priority**: 72
- **Size**: M
- **Dependencies**: feat-chat-panel-md-resize (样式参考), feat-newtask-dialog-adaptive (布局模式)
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-08

## Description

将 Task Detail Modal 中 Agent Tab 的 Review 和 Modify 操作从当前的单次执行模式升级为多轮对话模式，并同时支持 Markdown 和工具调用的结构化渲染，解决三个核心体验问题：

1. **Review / Modify 多轮对话** — 当前 Agent Tab 的 Review 和 Modify 操作只能单次发送 prompt，得到一坨纯文本输出。用户无法针对 Agent 的回复追问、修正或深入讨论。需要改造为 chat-style 多轮对话界面：用户发送消息后，Agent 回复展示在对话流中，用户可继续追问，形成真正的 back-and-forth 对话。
2. **Agent 回复 Markdown 渲染** — 当前 Agent 输出使用 `<pre>` 标签以纯文本形式展示（L2147-2148），丢失了所有格式信息。需要替换为 `MarkdownRenderer` 组件，使标题、列表、代码块、表格等元素得到正确渲染（对标 `feat-chat-panel-md-resize` 的 Markdown 渲染标准）。
3. **Tool Call / Tool Result 结构化渲染** — Agent 在执行过程中产生的 tool_call 和 tool_result 事件当前被忽略或合并到纯文本输出中。需要将这些事件以结构化 UI 展示（展开/折叠、工具名称、状态图标），对标 `feat-chat-panel-md-resize` 和 `feat-agent-tool-ui` 的工具渲染模式。

## User Value Points

1. **多轮交互能力** — 用户可以在 Review/Modify 场景中与 Agent 进行持续对话，追问细节、要求修改、逐步完善，而非只能单次发送后重新开始
2. **富内容可读性** — Agent 回复中的 Markdown 内容和工具调用事件以结构化、美观的方式呈现，信息层次清晰

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — Task Detail Modal + Agent Tab
  - L854-860: Agent 状态变量（agentAction, agentInput, agentSending, agentOutput, agentError, agentDone）
  - L1043-1164: `handleAgentSend` — 当前单次发送逻辑
  - L2012-2155: Agent Tab UI — Action 选择、textarea 输入、Send 按钮、`<pre>` 输出
  - L2146-2148: `<pre>` 纯文本输出区域（需改造为 Markdown + Tool 渲染）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — 多轮对话 UI 参考
  - Chat-style 消息列表 + 底部输入框布局
  - 消息类型区分（assistant, user, system）
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM/REQ Agent 对话面板参考
  - 多轮对话消息渲染模式
  - Tool call 消息组件
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — 已有的完整 Markdown 渲染组件
- `neuro-syntax-ide/src/components/RuntimeOutputModal.tsx` — Tool 事件渲染参考
  - SessionChunkRenderer: tool_use / TOOL_RESULT 事件解析与展示
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — 内置 PM Agent 对话 hook（多轮消息管理参考）
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式消息 hook

### Related Documents
- `features/pending-feat-chat-panel-md-resize/spec.md` — Markdown 渲染 + Tool 消息渲染样式标准
- `features/pending-feat-newtask-dialog-adaptive/spec.md` — 多轮对话自适应布局标准

### Related Features
- `feat-chat-panel-md-resize` (pending) — Agent 对话窗口 Markdown + Tool 渲染（样式对标）
- `feat-newtask-dialog-adaptive` (pending) — 多轮对话自适应布局（布局模式对标）
- `feat-agent-conversation` (completed) — Agent Tab 初始 Review/Modify/Develop 实现
- `feat-agent-tool-ui` (completed) — Agent 工具事件 UI 渲染
- `feat-chat-style-newtask` (completed) — Chat-style NewTask Modal 基础模式

## Technical Solution

### 1. 多轮对话消息模型
- 定义消息类型接口 `AgentChatMessage`：
  ```typescript
  type AgentChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result';
    content: string;
    timestamp: number;
    // tool call 专用
    toolName?: string;
    toolInput?: string;
    isCollapsible?: boolean;
  };
  ```
- 新增 `agentMessages: AgentChatMessage[]` 状态替代当前的单一 `agentOutput` 字符串
- 每次用户发送消息，追加 user message 到数组
- Agent 回复（streaming chunks）追加 assistant message / tool_call / tool_result

### 2. 对话 UI 改造
- Agent Tab 内容区改为 flex 纵向布局：`flex flex-col h-full`
- 消息列表：`flex-1 overflow-y-auto`，自动滚动到底部
- 底部输入区：`shrink-0`，textarea + Send 按钮，始终贴底
- 移除当前 `max-h-[240px]` 的固定输出区域
- 对标 `feat-newtask-dialog-adaptive` 的布局模式：
  - 弹窗内容区 `flex flex-col h-full`
  - 消息列表 `flex-1 overflow-y-auto`
  - 输入区 `shrink-0`

### 3. Markdown + Tool Call 渲染
- assistant 消息使用 `<MarkdownRenderer content={msg.content} />` 渲染
- tool_call 消息渲染为结构化卡片：工具名称 + 可展开的输入参数
- tool_result 消息渲染为结构化卡片：状态图标 + 可展开的结果内容（内容也支持 Markdown）
- 对标 `feat-chat-panel-md-resize` 的渲染标准：
  - 代码块：10px monospace，暗色背景
  - 表格：带边框和 hover 效果
  - Tool 消息：展开/折叠交互

### 4. Develop 操作保持不变
- Develop 操作仍走当前的 skill dispatch 模式（`/dev-agent {featureId}`）
- 仅 Review 和 Modify 改为多轮对话模式

### 5. 会话持久化
- 复用现有 `sessionStore` 机制，保存多轮消息历史
- 重新打开 Modal 时恢复对话上下文

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望在 Task Detail Modal 的 Agent Tab 中，Review 和 Modify 操作支持多轮对话，Agent 回复能以美观的 Markdown 格式呈现，工具调用事件以结构化 UI 展示。

### Scenarios (Given/When/Then)

#### Scenario 1: Review 多轮对话
```gherkin
Given 用户打开了 Task Detail Modal 并切换到 Agent Tab
When 用户选择 Review 操作并发送消息
Then Agent 回复应展示在对话流中
And 用户可以在输入框中继续追问
And 新的追问和 Agent 回复追加到对话流中
And 对话流自动滚动到最新消息
```

#### Scenario 2: Modify 多轮对话
```gherkin
Given 用户在 Agent Tab 中选择 Modify 操作
When 用户输入修改需求并发送
Then Agent 回复展示在对话流中
And 用户可以基于 Agent 回复继续提出修改意见
And 多轮对话历史完整保留
```

#### Scenario 3: Agent 回复 Markdown 渲染
```gherkin
Given 用户在 Agent Tab 多轮对话中与 Agent 交互
When Agent 返回包含标题、列表、代码块、表格的 Markdown 内容
Then 这些 Markdown 元素应正确渲染为对应的格式
And 代码块应有暗色背景和等宽字体
And 渲染效果与 feat-chat-panel-md-resize 的标准一致
```

#### Scenario 4: Tool Call 事件渲染
```gherkin
Given Agent 在执行 Review/Modify 过程中产生了工具调用
When tool_call 和 tool_result 事件出现在对话流中
Then tool_call 应以结构化卡片展示（工具名称、可展开的参数）
And tool_result 应以结构化卡片展示（状态图标、可展开的结果内容）
And 工具结果内容也支持 Markdown 渲染
```

#### Scenario 5: Develop 操作不受影响
```gherkin
Given 用户在 Agent Tab 中选择 Develop 操作
When 用户点击 Send
Then Develop 操作仍走原有的 skill dispatch 模式
And 不受多轮对话改造影响
```

#### Scenario 6: 会话恢复
```gherkin
Given 用户在 Agent Tab 中进行了多轮对话后关闭了 Modal
When 用户重新打开同一 Task 的 Detail Modal
Then 之前的对话历史应被恢复
And 用户可以继续对话
```

### UI/Interaction Checkpoints
- 对话消息列表自适应弹窗高度，弹窗 resize 时消息区域自动扩展/收缩
- 输入框始终固定在对话区底部，不随消息滚动
- Markdown 渲染：代码块字体 10px monospace，表格带边框和 hover 效果（对标 feat-chat-panel-md-resize）
- Tool call UI：展开/折叠交互，工具名称加粗，参数/结果可折叠（对标 feat-agent-tool-ui）
- 流式输出兼容：打字机效果不应被 Markdown 渲染打断
- 新消息到达时自动滚动到底部

### General Checklist
- [ ] 不影响 Develop 操作的现有行为
- [ ] 不影响 Spec / Tasks / Checklist Tab 的现有功能
- [ ] Markdown 渲染组件复用已有的 MarkdownRenderer
- [ ] Tool 渲染复用已有模式，保持与 ProjectView / NewTaskModal 视觉一致性
- [ ] 会话持久化复用现有 sessionStore 机制

## Merge Record
- **Completed**: 2026-05-13
- **Merged Branch**: feature/feat-task-agent-multiturn
- **Merge Commit**: 4622069
- **Feature Commit**: 74757ad
- **Archive Tag**: feat-task-agent-multiturn-20260513
- **Conflicts**: None
- **Verification**: PASS (21/21 tasks, 6/6 Gherkin scenarios, build passes)
- **Stats**: 3 files changed, 534 insertions, 160 deletions
