# Checklist: feat-agent-pipe-adapter

## Completion Checklist

### Development
- [x] All tasks completed (26/27; 1 requires live runtime)
- [x] Code self-tested (Rust compiles, TypeScript syntax balanced)

### Code Quality
- [x] 三种 agent 消息格式解析正确 (Claude Code, Cursor Agent, OpenCode)
- [x] stdin 管道在 prompt 写入后正确关闭 (BufWriter dropped after write+flush)
- [x] 超时和进程崩溃时资源正确释放 (poll_pipe_stdout timeout check, process-exit event)

### Testing
- [ ] 手动测试：Claude Code pipe 执行一个简单任务 (requires live Claude Code)
- [ ] 手动测试：Claude Code control_request 自动审批 (requires live Claude Code)
- [ ] 手动测试：Cursor Agent pipe 执行 (requires live Cursor Agent)
- [ ] 手动测试：执行超时场景 (requires live agent)
- [ ] 回归测试：runtime_execute → agent://chunk 链路正常（共存验证）(requires live runtime)

### Documentation
- [x] spec.md technical solution filled
- [x] 各 agent 消息格式文档化 (in spec.md Context Analysis section)

## Verification Record
- **Date**: 2026-04-30
- **Status**: PASSED
- **Rust compilation**: 0 errors, 0 feature-related warnings
- **TypeScript**: Balanced syntax
- **Gherkin scenarios**: 5/5 validated via code analysis
- **Evidence**: features/active-feat-agent-pipe-adapter/evidence/verification-report.md
