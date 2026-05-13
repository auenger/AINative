# Feature: feat-chat-panel-md-resize

## Basic Information
- **ID**: feat-chat-panel-md-resize
- **Name**: Agent 对话窗口 Markdown 渲染优化与面板横向拖拽调整
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-08

## Description

优化 Project 页面中 PM Agent 和 REQ Agent 对话窗口的三个核心体验问题：

1. **对话消息 Markdown 渲染升级** — 当前 assistant 消息虽然已用 `<ReactMarkdown>` 包裹，但样式仅用简易 `prose prose-invert prose-xs`，渲染效果粗糙。需替换为已有的 `MarkdownRenderer` 组件，获得完整的 GFM 支持（标题层级、表格、任务列表、代码块高亮等）。
2. **对话窗口与 MD FILES 横向拖拽调整** — 当前左侧 chat panel 固定 `w-[400px]`，右侧 MD FILES 区域占剩余空间。需加入可拖拽分隔条，允许用户自由调整两个区域的宽度比例。
3. **init/系统消息与 tool 消息 MD 渲染** — REQ Agent 的 init 状态文本（如 "32 tools available, model: GLM-5.1"）、greeting 消息、tool call 消息的内容也需要支持 Markdown 渲染，而非纯文本。

## User Value Points

1. **对话内容可读性提升** — Assistant 回复中的标题、列表、代码块、表格等 Markdown 元素得到正确渲染，信息层次清晰
2. **面板宽度灵活调整** — 用户可根据需求拖拽调整对话窗口和文件浏览区的宽度，适应不同工作场景
3. **系统/工具消息美观渲染** — init 信息、greeting、tool 结果等内容也以 Markdown 格式呈现，视觉一致性统一

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 主页面，包含 PM Agent 和 REQ Agent 对话面板布局
  - L612: chat panel 固定 `w-[400px]`
  - L736-764: PM Agent 消息渲染（L752-753 使用 `<ReactMarkdown>`）
  - L1092-1122: REQ Agent 消息渲染（L1108-1109 使用 `<ReactMarkdown>`）
  - L68-130: `ToolCallMessage` 组件（L116 直接输出 `msg.content` 纯文本）
  - L1246: MD FILES 区域 `flex-1`
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — 已有的完整 Markdown 渲染组件（react-markdown + remark-gfm + 暗色主题样式）
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式消息 hook，greeting 消息定义

### Related Documents
- 已有 `feat-file-tree-resizable` 实现了文件树拖拽调整，可参考其实现模式

### Related Features
- `feat-file-tree-resizable` (已完成) — 文件树横向拖拽调整，可复用拖拽逻辑
- `feat-runtime-output-polish` (已完成) — Runtime 输出渲染优化
- `feat-agent-tool-ui` (已完成) — Agent 工具事件 UI 渲染

## Technical Solution

### 1. 对话消息 Markdown 渲染升级
- 将 ProjectView.tsx 中 PM Agent（L752-753）和 REQ Agent（L1108-1109）的 `<ReactMarkdown>` 替换为 `<MarkdownRenderer>`
- 调整外层 `div` 的 `prose` 相关样式类，适配 MarkdownRenderer 的内置样式

### 2. 面板横向拖拽调整
- 在 chat panel 和 MD FILES 区域之间添加可拖拽分隔条（resize handle）
- 使用 `useState` 管理 chat panel 宽度（默认 400px）
- 监听 `mousedown` → `mousemove` → `mouseup` 事件链实现拖拽
- 设置最小宽度约束（chat: 280px, MD FILES: 300px）
- 参考 `feat-file-tree-resizable` 的拖拽实现模式

### 3. init/系统消息与 tool 消息 MD 渲染
- `ToolCallMessage` 组件（L68-130）中的 `msg.content` 和 `msg.toolResult` 使用 MarkdownRenderer 渲染
- 系统消息（如连接状态信息）同样使用 MarkdownRenderer

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Agent 对话窗口中的消息以美观的 Markdown 格式呈现，并且可以自由调整对话窗口和文件浏览区的宽度比例。

### Scenarios (Given/When/Then)

#### Scenario 1: Assistant 消息 Markdown 渲染
```gherkin
Given 用户在 Project 页面打开了 PM Agent 或 REQ Agent 对话窗口
When Agent 返回包含标题、列表、代码块、表格的 Markdown 内容
Then 这些 Markdown 元素应正确渲染为对应的 HTML 格式
And 代码块应有暗色背景和适当的字体大小
And 表格应有边框和斑马纹效果
```

#### Scenario 2: 面板拖拽调整
```gherkin
Given 用户在 Project 页面且 Agent 对话窗口和 MD FILES 区域并排显示
When 用户拖拽两个区域之间的分隔条
Then 对话窗口和 MD FILES 区域的宽度应随鼠标移动实时调整
And 最小宽度约束生效（对话窗口 >= 280px, MD FILES >= 300px）
And 分隔条应有视觉提示（hover 效果、cursor 样式）
```

#### Scenario 3: Tool 消息 Markdown 渲染
```gherkin
Given Agent 正在执行工具调用或已返回工具结果
When 工具消息中包含 Markdown 格式的内容
Then 内容应以 Markdown 格式渲染，而非纯文本
```

#### Scenario 4: 拖拽后布局稳定性
```gherkin
Given 用户已拖拽调整面板宽度
When 切换 PM/REQ Agent Tab 或发送新消息
Then 面板宽度应保持用户设置的值
And 不应出现布局抖动或闪烁
```

### UI/Interaction Checkpoints
- 拖拽手柄：分隔条宽度 4px，hover 时高亮为 primary 色，cursor: col-resize
- 拖拽中：添加 `select-none` 防止文本选中
- Markdown 渲染：代码块字体 10px monospace，表格带边框和 hover 效果

### General Checklist
- [x] 不影响现有 Agent 消息收发功能
- [x] 拖拽操作流畅，无卡顿
- [x] Markdown 渲染不影响流式输出效果（打字机动画）
- [x] 响应式：窗口缩小时布局不溢出

## Merge Record

| Field | Value |
|-------|-------|
| completed_at | 2026-05-13T15:00:00Z |
| merged_branch | feature/chat-panel-md-resize |
| merge_commit | 1df4982 |
| archive_tag | feat-chat-panel-md-resize-20260513 |
| conflicts | none |
| verification | passed (4/4 Gherkin scenarios) |
| started_at | 2026-05-13T14:00:00Z |
| duration | ~1 hour |
| commits | 1 |
| files_changed | 1 |
