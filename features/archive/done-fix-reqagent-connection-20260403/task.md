# Tasks: fix-reqagent-connection

## Task Breakdown

### 1. Rust 后端重构 — 改为 per-message 进程模型
- [x] 新增 `req_agent_send_message` command：每次发送消息启动新 CLI 进程
- [x] 简化 `req_agent_start`：仅做 CLI 检查 + session ID 管理，不启动长驻进程
- [x] `req_agent_send_message` 使用 `--print --resume --session-id` 启动临时进程
- [x] stdout reader 持续读取直到 EOF，不在 result 处 break
- [x] 移除 reader 退出后的无条件 disconnect 事件
- [x] 确保进程退出后 stdin/stdout/stderr 资源释放
- [x] 保留 `req_agent_stop` 和 `req_agent_status` commands

### 2. 前端 Hook 修复 — 连接状态与消息收发
- [x] 在 `startSession` 成功后注册持久 `req_agent_chunk` listener
- [x] 持久 listener 处理 disconnect/error 事件，更新连接状态
- [x] `sendMessage` 不再自行注册 listener，改用持久 listener 接收响应
- [x] `sendMessage` 调用新的 `req_agent_send_message` command
- [x] `sendMessage` catch 错误时更新 connectionState 为 error
- [x] 重连时清除旧 session ID，生成新 session（不 resume 旧会话）
- [x] 组件卸载时清理持久 listener

### 3. UI 交互修复
- [x] 验证连接状态指示灯正确反映实际状态
- [x] 验证错误 banner 正确显示和可关闭
- [x] 验证 "Thinking..." 状态在 streaming 期间显示
- [x] 验证重连后聊天历史清除并显示欢迎消息

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 根因分析完成，方案设计完成 |
| 2026-04-03 | Implementation complete | Rust per-message model + frontend persistent listener |
