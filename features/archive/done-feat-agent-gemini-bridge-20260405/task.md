# Tasks: feat-agent-gemini-bridge

## Task Breakdown

### 1. GeminiHttpRuntime 实现
- [x] 创建 `GeminiHttpRuntime` struct
- [x] 实现 `AgentRuntime` trait 的所有方法
- [x] 实现 `execute()` — HTTP SSE 流式请求
- [x] 实现 `detect()` — 检测 API Key 是否配置
- [x] 实现 `health_check()` — 验证 API Key 有效性

### 2. 注册到 RuntimeRegistry
- [x] `GeminiHttpRuntime` 在 AppState 初始化时注册
- [x] scan_agent_runtimes 包含 Gemini runtime

### 3. PM Agent 前端迁移
- [x] `useAgentChat.ts` 改为调用 `runtime_execute`
- [x] 事件监听从 `pm_agent_chunk` 迁移到 `agent://chunk`

### 4. 测试
- [x] PM Agent 功能与迁移前一致
- [x] API Key 未配置时正确提示

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | GeminiHttpRuntime 实现完成 | Rust struct + AgentRuntime trait, HTTP SSE 流式 |
| 2026-04-05 | 注册到 RuntimeRegistry | create_default_registry() 已注册 gemini-http |
| 2026-04-05 | PM Agent 前端迁移 | useAgentChat.ts 改用 runtime_execute + agent://chunk |
