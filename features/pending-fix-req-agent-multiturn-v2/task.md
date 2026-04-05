# Tasks: fix-req-agent-multiturn-v2

## Task Breakdown

### 1. 诊断验证
- [x] 添加 eprintln! 到后端 runtime_execute，确认 sessionId 传递
- [x] 添加 eprintln! 到后端 ClaudeCodeRuntime::execute stderr 诊断
- [ ] 手动 CLI 测试 `--resume` 是否工作（确认 session 持久化）— 需要用户手动验证

### 2. 前端修复 (useAgentStream.ts)
- [x] 使用 useRef 跟踪 sessionId，避免闭包过期 (sessionIdRef)
- [x] stderr 错误不再静默吞掉（console.warn 记录，无文本时 setError 显示）
- [x] process_exit 事件在 streaming 时正确处理（已有文本时忽略 process_exit）

### 3. 后端修复 (lib.rs)
- [x] ClaudeCodeRuntime::execute() 改进 stderr 错误传递（eprintln! 服务端日志）
- [x] 区分 result is_done 和 process_exit is_done（got_result 标志位）
- [x] runtime_execute 添加 sessionId 诊断日志
- [ ] 为 --resume 添加 session 存在性检查（可选，延后）

### 4. 验证
- [ ] 端到端测试：首轮对话正常
- [ ] 端到端测试：多轮对话上下文保持
- [ ] 端到端测试：错误场景显示正确信息

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | Created | Feature created based on user bug report |
| 2026-04-05 | Implemented | Frontend: sessionIdRef, stderr logging, process_exit handling. Backend: got_result guard, diagnostic logs. Rust compiles clean. |
