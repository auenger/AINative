# Tasks: feat-agent-unified-stream

## Task Breakdown

### 1. 统一 Hook 实现
- [x] 创建 `useAgentStream` hook
- [x] 统一事件监听 `agent://chunk`
- [x] 支持 runtimeId / systemPrompt / greetingMessage 配置

### 2. ProjectView 迁移
- [x] PM Agent tab 改用 `useAgentStream({ runtimeId: 'gemini-http' })`
- [x] REQ Agent tab 改用 `useAgentStream({ runtimeId: 'claude-code' })`
- [x] 移除对旧 hook 的引用

### 3. 清理
- [ ] 删除 `useAgentChat.ts`（保留旧文件，向后兼容；其他组件可能引用）
- [ ] 删除 `useReqAgentChat.ts`（保留旧文件，向后兼容；其他组件可能引用）
- [ ] 删除旧的 Tauri commands（`agent_chat_stream`, `req_agent_send_message` 等）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | Tasks 1 & 2 complete | useAgentStream hook created, ProjectView migrated. Old hooks retained for NewTaskModal backward compat. Build passes. |
