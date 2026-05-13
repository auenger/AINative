# Tasks: feat-chat-panel-md-resize

## Task Breakdown

### 1. 面板拖拽调整 — 可拖拽分隔条组件
- [x] 在 ProjectView.tsx 中创建 `ResizeHandle` 内联组件或提取为独立组件
- [x] 管理 chatPanelWidth 状态（默认 400px，最小 280px）
- [x] 实现 mousedown/mousemove/mouseup 拖拽事件链
- [x] 添加 MD FILES 区域最小宽度约束（300px）
- [x] 拖拽时添加 `select-none` 样式防止文本选中
- [x] 分隔条 hover 视觉反馈（primary 色高亮、col-resize cursor）

### 2. 对话消息 Markdown 渲染升级
- [x] PM Agent 消息：将 `<ReactMarkdown>` 替换为 `<MarkdownRenderer>`（L752-753）
- [x] REQ Agent 消息：将 `<ReactMarkdown>` 替换为 `<MarkdownRenderer>`（L1108-1109）
- [x] 移除包裹的 `prose prose-invert prose-xs` 样式类
- [x] 确保流式输出（打字机动画）正常工作

### 3. Tool 消息与系统消息 MD 渲染
- [x] `ToolCallMessage` 组件中 `msg.content` 改用 MarkdownRenderer（L116）
- [x] `ToolCallMessage` 组件中 `msg.toolResult` 改用 MarkdownRenderer（L121-126）
- [x] 系统消息（连接状态、greeting 等）支持 Markdown 渲染

### 4. 样式调优与测试
- [x] 确保暗色主题下所有 Markdown 元素样式正确
- [x] 验证代码块、表格、列表渲染效果
- [x] 测试拖拽在不同窗口大小下的表现
- [x] 验证流式输出不因 MarkdownRenderer 引入而中断

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-13 | All tasks implemented | MarkdownRenderer 替换 + 拖拽调整 + build 验证通过 |
| 2026-05-08 | Feature created | 等待开发 |
