# Tasks: feat-agent-stdio-core

## Task Breakdown

### 1. Rust 核心类型定义
- [ ] 定义 `AgentBackend`、`ProtocolType`、`AgentConfig` 枚举/结构体
- [ ] 定义 `StdioSession` — 包含 Child 进程、stdin/stdout 管道
- [ ] 定义 `AgentMessage`、`AgentResult` 统一消息类型
- [ ] 定义 `SessionStatus`、`CompletionStatus` 状态枚举

### 2. StdioSessionManager 实现
- [ ] `spawn(config)` — exec.Command + StdoutPipe + StdinPipe + 启动子进程
- [ ] `send_raw(session_id, data)` — 写入 stdin 管道
- [ ] `read_raw(session_id)` — 非阻塞读取 stdout（BufReader + 行扫描）
- [ ] `destroy(session_id)` — 优雅关闭（SIGTERM → 等待 → SIGKILL）
- [ ] `health_check(session_id)` — 检查子进程存活状态
- [ ] `list_sessions()` — 返回所有活跃 session

### 3. stdout 轮询与事件广播
- [ ] 每个 session 启动独立 tokio task 轮询 stdout
- [ ] 新行通过 `app.emit("agent://raw-stdout", ...)` 广播到前端
- [ ] 进程退出时 emit `agent://process-exit`
- [ ] 状态变更时 emit `agent://session-status`

### 4. Tauri Command 注册
- [ ] 注册 `agent_spawn`、`agent_send_raw`、`agent_read_raw`
- [ ] 注册 `agent_destroy`、`agent_list_sessions`、`agent_health_check`
- [ ] 在 `lib.rs` 中添加到 command 列表

### 5. 前端 Hook 更新
- [ ] 创建 `useStdioAgent.ts` hook — 封装新 IPC 调用
- [ ] 监听 `agent://raw-stdout`、`agent://session-status`、`agent://process-exit`
- [ ] 与现有 `useAgentStream.ts` 共存

### 6. 共存验证（方案 B 必须）
- [ ] 确认 StdioSessionManager 作为独立 Rust 模块，不修改 AgentRuntime trait
- [ ] 确认新增 commands（agent_spawn 等）与 runtime_execute 并行注册在 lib.rs
- [ ] 确认新增 events（agent://raw-stdout 等）与 agent://chunk 事件隔离
- [ ] 回归测试：通过 runtime_execute 执行 Claude Code 任务，验证 agent://chunk 链路正常

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | Feature created | 初始设计完成 |
