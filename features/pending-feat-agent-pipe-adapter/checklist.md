# Checklist: feat-agent-pipe-adapter

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested

### Code Quality
- [ ] 三种 agent 消息格式解析正确
- [ ] stdin 管道在 prompt 写入后正确关闭
- [ ] 超时和进程崩溃时资源正确释放

### Testing
- [ ] 手动测试：Claude Code pipe 执行一个简单任务
- [ ] 手动测试：Claude Code control_request 自动审批
- [ ] 手动测试：Cursor Agent pipe 执行
- [ ] 手动测试：执行超时场景
- [ ] 回归测试：runtime_execute → agent://chunk 链路正常（共存验证）

### Documentation
- [ ] spec.md technical solution filled
- [ ] 各 agent 消息格式文档化
