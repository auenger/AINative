# Tasks: fix-req-agent-multiturn

## Task Breakdown

### 1. Rust Backend — CLI 参数 + JSON 解析修复
- [x] 添加 `--verbose` 到 CLI args
- [x] 修复 `assistant` 类型 JSON 解析（`message.content[].text`）
- [x] 修复 `result` 类型错误检测（`is_error` 字段）
- [ ] 验证 `runtime_session_stop` 清理 `req_agent` 状态完整性

### 2. Frontend Hook — useAgentStream 多轮修复
- [x] `startSession` 不存储假 UUID，从 chunk 响应捕获真实 session_id
- [ ] `is_done` 处理改为 persistent listener 模式（`useSessions=true` 时不 unlisten）
- [ ] `sendMessage` 中为 session 模式确保 listener 存在（防意外丢失）
- [ ] `stopSession` 确保完整状态清理（streamingTextRef、error）

### 3. Frontend Hook — 状态初始化保障
- [ ] `newSession` 确保清空 streamingTextRef 和 error
- [ ] `stopSession` 后验证 `checkStatus` 不会读到过期数据
- [ ] unmount 时清理 listener 和状态

### 4. 端到端验证
- [ ] CLI 直接测试：首次无 session → 成功
- [ ] CLI 直接测试：`--resume --session-id <real-id>` → 成功
- [ ] App 内测试：REQ Agent 首次对话 → 流式响应
- [ ] App 内测试：REQ Agent 多轮对话 → 上下文保持
- [ ] App 内测试：停止会话 → 状态清理
- [ ] App 内测试：新建会话 → 完全重置

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-04 | 50% | CLI 参数 + JSON 解析 + 假 UUID 问题已修复 |
| 2026-04-04 | 待开始 | 多轮 listener 持久化 + 状态清理 |
