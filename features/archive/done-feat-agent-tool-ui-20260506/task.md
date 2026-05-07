# Tasks: feat-agent-tool-ui

## Task Breakdown

### 1. 消息类型扩展
- [x] ChatMessage 接口添加 `isToolCall`, `toolName`, `toolStatus`, `toolResult` 字段
- [x] 类型定义在 `types.ts` 或本地

### 2. useAgentStream 事件处理
- [x] chunk listener 添加 `tool_use` 类型处理
- [x] chunk listener 添加 `tool_result` 类型处理
- [x] 工具状态消息的增删改逻辑

### 3. UI 渲染
- [x] PM Agent 聊天面板中工具调用消息的特殊样式
- [x] running / success / error 三种状态视觉区分

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-06 | Feature created | 从 feat-agent-tool-loop 拆分 |
| 2026-05-06 | Implementation complete | 所有 3 个 task 已完成 |
