# Tasks: feat-newtask-dialog-adaptive

## Task Breakdown

### 1. 布局自适应改造
- [x] 分析 NewTaskModal 当前 flex 布局结构，确定改造方案
- [x] 将弹窗内容区改为 `flex flex-col h-full` 结构
- [x] 消息列表区域改为 `flex-1 overflow-y-auto`，移除固定 `max-h-[320px]`
- [x] 输入区域添加 `shrink-0` 确保不被压缩
- [x] 验证弹窗 resize 时布局正确响应

### 2. Markdown 渲染升级
- [x] 将多轮对话中 assistant 消息的渲染替换为 MarkdownRenderer
- [x] 调整外层容器样式，适配 MarkdownRenderer 的内置样式
- [x] 确保流式输出（打字机效果）与 Markdown 渲染兼容

### 3. 工具调用渲染
- [x] 识别 NewTaskModal 中工具调用消息的数据结构
- [x] 复用 ProjectView / feat-agent-tool-ui 的工具调用 UI 模式
- [x] 实现 tool_call / tool_result 的结构化展示
- [x] 添加展开/折叠交互（如适用）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-11 | All tasks implemented | 布局自适应 + Markdown渲染已有 + 工具调用渲染 |
| 2026-05-08 | Feature created | 初始任务拆解 |
