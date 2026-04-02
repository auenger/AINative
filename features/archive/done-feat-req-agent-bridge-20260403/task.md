# Tasks: feat-req-agent-bridge

## Task Breakdown

### 1. 数据结构与类型定义
- [x] 定义 `ReqAgentChunkEvent` 结构体（对齐 stream-json 输出格式）
- [x] 定义 `ReqAgentService` 状态结构体（process, session_id, stdin）
- [x] 定义 Tauri command 参数/返回类型

### 2. 子进程管理
- [x] 实现 `req_agent_start` — spawn Claude CLI 子进程
- [x] 实现 `req_agent_stop` — 优雅终止子进程
- [x] 实现 `req_agent_status` — 查询当前状态
- [x] 实现 `req_agent_send` — 通过 stdin 发送 JSON 消息

### 3. 流式响应读取
- [x] 实现后台线程读取 stdout
- [x] 解析 stream-json 协议
- [x] 通过 Tauri event 推送 chunk 到前端

### 4. 会话管理
- [x] 生成和管理 session_id (UUID)
- [x] 实现 --resume 恢复已有会话
- [x] 子进程异常退出的检测和重启

### 5. 错误处理
- [x] CLI 未安装检测
- [x] 认证失败提示
- [x] 子进程异常退出的自动恢复

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 待开发 |
| 2026-04-03 | All tasks implemented | Rust backend: ReqAgentChunkEvent, ReqAgentState, 4 Tauri commands |
