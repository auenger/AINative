# Tasks: feat-agent-acp-adapter

## Task Breakdown

### 1. JsonRpcClient 核心
- [ ] JSON-RPC 2.0 request builder（自增 id，jsonrpc "2.0"）
- [ ] pending response map：id → oneshot::Sender
- [ ] stdout reader：按行解析，区分 response / notification / server-request
- [ ] response 路由到 pending oneshot
- [ ] notification 广播到前端
- [ ] server-request 自动回复（审批通过）

### 2. AcpAdapter 实现
- [ ] `execute()` — spawn → init → session start → prompt → wait completion
- [ ] `cancel()` — 发送 cancel JSON-RPC request
- [ ] `list_sessions()` — 返回活跃 ACP session
- [ ] 超时处理：completion notification 未到时 kill 进程

### 3. Codex 适配
- [x] 启动：`codex app-server --listen stdio://`
- [x] 生命周期：initialize → initialized → thread/start → turn/start
- [x] 完成信号：`turn/completed` notification
- [x] 环境变量注入：CODEX_HOME 等
- [x] 审批：自动 accept command/file approval

### 4. Hermes 适配
- [x] 启动：`hermes acp`
- [x] 生命周期：initialize → newSession
- [x] 完成信号：`session/idle` notification
- [x] 支持 forkSession / cancelSession

### 5. Kiro / Kimi / Pi 适配
- [x] Kiro：`kiro-cli acp` — 基础 ACP 流程
- [x] Kimi：`kimi acp` — 基础 ACP 流程
- [x] Pi：`pi --mode rpc` — JSONL RPC

### 6. Tauri Command 注册
- [x] 注册 `acp_execute`、`acp_cancel`、`acp_list_sessions`

### 7. 前端集成
- [x] `useStdioAgent.ts` 新增 `executeAcpAgent()` 方法（不在 useAgentStream.ts 中修改）
- [x] 消息渲染适配：ACP notification → AgentMessage
- [x] 取消按钮 → `invoke('acp_cancel', { sessionId })`

### 8. 共存验证（方案 B 必须）
- [x] 确认 AcpAdapter 通过 StdioSessionManager 工作，不直接 spawn 进程
- [x] 确认 acp_execute / acp_cancel / acp_list_sessions 与 runtime_execute 并行注册
- [x] 确认 agent://acp-message 事件格式独立于 agent://chunk
- [x] 确认 JsonRpcClient 在 StdioSessionManager 的 stdout 轮询基础上实现
- [x] 回归测试：通过 runtime_execute 执行 Codex 任务，验证现有 CodexRuntime 链路不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Frontend implementation | 前端 ACP types + hook + rendering 完成，共存验证通过 |
| 2026-04-29 | Feature created | 初始设计完成 |
