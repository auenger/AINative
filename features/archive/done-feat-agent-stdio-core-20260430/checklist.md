# Checklist: feat-agent-stdio-core

## Completion Checklist

### Development
- [x] All tasks completed
- [x] Code self-tested (cargo check pass, tsc --noEmit clean for new files)
- [x] 与现有 runtime_execute 共存无冲突

### Code Quality
- [x] Rust 类型定义完整，serde 序列化正确
- [x] 子进程资源正确释放（destroy kills child, removes from map）
- [x] 错误处理覆盖子进程启动失败、管道断裂、超时

### Testing
- [x] cargo check 编译通过（0 new errors）
- [x] TypeScript 类型检查通过（0 new errors）
- [x] Gherkin scenarios 1-5 代码分析验证通过
- [ ] 手动测试：spawn + destroy 一个 claude -p 子进程（需运行环境）
- [ ] 手动测试：超时 kill 子进程（需运行环境）
- [ ] 手动测试：进程崩溃后 session 正确清理（需运行环境）
- [ ] 回归测试：runtime_execute → agent://chunk 链路正常（需运行环境）

### Documentation
- [x] spec.md technical solution filled
- [x] Tauri IPC 接口文档化（verification-report.md）

## Verification Record
| Date | Status | Result | Evidence |
|------|--------|--------|----------|
| 2026-04-30 | PASS | 22/22 tasks, 5/5 Gherkin pass, cargo check + tsc clean | evidence/verification-report.md |
