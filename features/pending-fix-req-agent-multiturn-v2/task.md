# Tasks: fix-req-agent-multiturn-v2

## Task Breakdown

### 1. 诊断验证
- [ ] 手动 CLI 测试 `--resume` 是否工作（确认 session 持久化）
- [ ] 添加临时 console.log 到前端 sendMessage，确认 sessionId 值
- [ ] 添加 eprintln! 到后端 ClaudeCodeRuntime::execute，确认 CLI args

### 2. 前端修复 (useAgentStream.ts)
- [ ] 使用 useRef 跟踪 sessionId，避免闭包过期
- [ ] stderr 错误不再静默吞掉（console.warn 记录）
- [ ] process_exit 事件在 streaming 时正确处理

### 3. 后端修复 (lib.rs)
- [ ] ClaudeCodeRuntime::execute() 改进 stderr 错误传递
- [ ] 区分 result is_done 和 process_exit is_done
- [ ] 为 --resume 添加 session 存在性检查（可选）

### 4. 验证
- [ ] 端到端测试：首轮对话正常
- [ ] 端到端测试：多轮对话上下文保持
- [ ] 端到端测试：错误场景显示正确信息

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | Created | Feature created based on user bug report |
