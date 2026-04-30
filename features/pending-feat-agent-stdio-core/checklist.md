# Checklist: feat-agent-stdio-core

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] 与现有 runtime_execute 共存无冲突

### Code Quality
- [ ] Rust 类型定义完整，serde 序列化正确
- [ ] 子进程资源正确释放（无 zombie process）
- [ ] 错误处理覆盖子进程启动失败、管道断裂、超时

### Testing
- [ ] 手动测试：spawn + destroy 一个 claude -p 子进程
- [ ] 手动测试：超时 kill 子进程
- [ ] 手动测试：进程崩溃后 session 正确清理
- [ ] 回归测试：runtime_execute → agent://chunk 链路正常（共存验证）

### Documentation
- [ ] spec.md technical solution filled
- [ ] Tauri IPC 接口文档化
