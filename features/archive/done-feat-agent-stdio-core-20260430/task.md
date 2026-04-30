# Tasks: feat-agent-stdio-core

## Task Breakdown

### 1. Rust 核心类型定义
- [x] 定义 `AgentBackend`、`ProtocolType`、`AgentSpawnConfig` 枚举/结构体
- [x] 定义 `StdioSession` — 包含 Child 进程、stdin/stdout 管道
- [x] 定义 `AgentMessage`、`AgentResult` 统一消息类型（通过事件结构体实现）
- [x] 定义 `SessionStatus`、`CompletionStatus` 状态枚举

### 2. StdioSessionManager 实现
- [x] `spawn(config)` — Command + StdoutPipe + StdinPipe + 启动子进程
- [x] `send_raw(session_id, data)` — 写入 stdin 管道
- [x] `read_raw(session_id)` — 非阻塞读取 stdout（事件驱动，返回提示信息）
- [x] `destroy(session_id)` — 优雅关闭（kill + wait）
- [x] `health_check(session_id)` — 检查子进程存活状态
- [x] `list_sessions()` — 返回所有活跃 session

### 3. stdout 轮询与事件广播
- [x] 每个 session 启动独立 thread 轮询 stdout（BufReader + lines）
- [x] 新行通过 `app.emit("agent://raw-stdout", ...)` 广播到前端
- [x] 进程退出时 emit `agent://process-exit`
- [x] 状态变更时 emit `agent://session-status`
- [x] 超时检测并 emit Timeout 状态

### 4. Tauri Command 注册
- [x] 注册 `agent_spawn`、`agent_send_raw`、`agent_read_raw`
- [x] 注册 `agent_destroy`、`agent_list_sessions`、`agent_health_check`
- [x] 在 `lib.rs` 中添加到 command 列表
- [x] `stdio_manager` 添加到 AppState

### 5. 前端 Hook 更新
- [x] 创建 `useStdioAgent.ts` hook — 封装新 IPC 调用
- [x] 监听 `agent://raw-stdout`、`agent://session-status`、`agent://process-exit`
- [x] 与现有 `useAgentStream.ts` 共存（未修改后者）

### 6. 共存验证（方案 B 必须）
- [x] 确认 StdioSessionManager 作为独立 Rust 模块，不修改 AgentRuntime trait
- [x] 确认新增 commands（agent_spawn 等）与 runtime_execute 并行注册在 lib.rs
- [x] 确认新增 events（agent://raw-stdout 等）与 agent://chunk 事件隔离
- [x] Rust 代码 cargo check 编译通过，无新增错误

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | Feature created | 初始设计完成 |
| 2026-04-30 | Implementation complete | 全部 6 个 task 完成，cargo check 通过 |
