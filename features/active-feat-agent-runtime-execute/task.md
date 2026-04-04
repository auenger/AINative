# Tasks: feat-agent-runtime-execute

## Task Breakdown

### 1. AgentRuntime Trait 扩展
- [ ] 新增 `ExecuteParams` struct（message, session_id, workspace, system_prompt, timeout_secs）
- [ ] 新增 `StreamEvent` struct（text, is_done, error, msg_type, session_id）
- [ ] `AgentRuntime` trait 新增 `execute()` 方法
- [ ] `AgentRuntime` trait 新增 `is_ready()` 方法

### 2. ClaudeCodeRuntime execute() 实现
- [ ] 实现 `execute()` 方法：spawn CLI 进程 + channel 通信
- [ ] 替换 `--permission-mode acceptEdits` 为 `--dangerously-skip-permissions`
- [ ] 实现 120s 超时监控线程
- [ ] 实现 stdout JSON 解析（stream-json 格式）
- [ ] 实现 stderr 错误捕获与转发
- [ ] 进程异常退出时发送 `is_done: true` 事件

### 3. 新增 Tauri Command
- [ ] `runtime_execute` command：接收 runtime_id + message，调用 RuntimeRegistry.execute()
- [ ] `runtime_session_start` command：创建新会话
- [ ] `runtime_session_stop` command：终止会话
- [ ] 注册到 invoke_handler

### 4. REQ Agent 前端迁移
- [ ] `useReqAgentChat.ts` 改为调用 `runtime_execute`
- [ ] 事件监听从 `req_agent_chunk` 迁移到 `agent://chunk`
- [ ] 保留向后兼容（旧 command 暂不删除）

### 5. 测试与验证
- [ ] Claude CLI 未安装时测试
- [ ] Claude CLI 已安装正常对话测试
- [ ] 超时场景测试
- [ ] 认证过期场景测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
