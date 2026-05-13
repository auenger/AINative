# Tasks: feat-task-agent-multiturn

## Task Breakdown

### 1. 消息模型与状态管理
- [x] 定义 `AgentChatMessage` 类型（user / assistant / system / tool_call / tool_result）
- [x] 新增 `agentMessages` 状态数组替代 `agentOutput` 字符串
- [x] 实现消息追加、清空、恢复逻辑
- [x] 更新 `sessionStore` 持久化以支持消息数组

### 2. 多轮对话 UI 布局
- [x] Agent Tab 内容区改为 flex 纵向布局（`flex flex-col`）
- [x] 消息列表区域：`flex-1 overflow-y-auto`，自动滚动到底部
- [x] 底部输入区：`shrink-0`，textarea + Send 按钮，始终贴底
- [x] Action Type 选择器移至对话区顶部或输入区旁边
- [x] 移除当前 `max-h-[240px]` 固定输出区域（review/modify 模式）

### 3. Markdown 渲染
- [x] assistant 消息使用 `<MarkdownRenderer>` 组件渲染
- [x] 保持流式输出兼容（打字机效果 + Markdown 渐进渲染）

### 4. Tool Call / Tool Result 结构化渲染
- [x] 解析 streaming 事件中的 tool_use 和 tool_result 类型
- [x] tool_call 消息渲染为结构化卡片（工具名称 + 可展开参数）
- [x] tool_result 消息渲染为结构化卡片（状态图标 + 可展开结果，结果支持 Markdown）

### 5. 对话逻辑
- [x] Review 模式：首条消息构建 review prompt，后续消息直接追问
- [x] Modify 模式：首条消息构建 modify prompt，后续消息直接追问
- [x] Develop 模式：保持原有 skill dispatch 不变
- [x] 会话恢复：重新打开 Modal 时恢复消息历史

### 6. 样式对齐
- [x] Markdown 渲染样式对标 `feat-chat-panel-md-resize`
- [x] 对话布局样式对标 `feat-newtask-dialog-adaptive`
- [x] Tool UI 样式对标 `feat-agent-tool-ui`

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-13 | All 6 tasks completed | Build passes. Multi-turn chat for Review/Modify, Markdown rendering, Tool Call UI, session persistence |
