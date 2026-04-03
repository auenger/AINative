# Tasks: feat-req-agent-chat

## Task Breakdown

### 1. Hook 开发
- [x] 创建 `useReqAgentChat.ts` hook
- [x] 对接 `req_agent_start` / `req_agent_send` / `req_agent_stop` IPC
- [x] 监听 `req_agent_chunk` 事件，流式更新消息
- [x] 实现会话状态管理

### 2. UI 集成
- [x] ProjectView 中添加需求分析 Agent 入口
- [x] 复用/适配聊天消息列表组件
- [x] Agent 状态指示器（连接中/已连接/断开）
- [x] "新建会话" / "停止" 按钮

### 3. 会话持久化
- [x] 保存 session_id 到 localStorage
- [x] 打开页面时自动恢复会话
- [x] 会话列表管理（可选）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 待开发 |
| 2026-04-03 | All tasks completed | Hook + UI + persistence implemented, tsc passes clean |
