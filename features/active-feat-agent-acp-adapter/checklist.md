# Checklist: feat-agent-acp-adapter

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested

### Code Quality
- [ ] JSON-RPC 2.0 协议实现符合规范
- [ ] pending map 无内存泄漏（response 到达后清理）
- [ ] 并发安全（多个 session 同时运行）
- [ ] 错误处理覆盖所有 JSON-RPC error code

### Testing
- [ ] 手动测试：Codex JSON-RPC 执行一个简单任务
- [ ] 手动测试：Hermes ACP 执行
- [ ] 手动测试：取消正在执行的任务
- [ ] 手动测试：审批自动通过
- [ ] 手动测试：Agent 启动失败错误处理
- [ ] 回归测试：runtime_execute → CodexRuntime → agent://chunk 链路正常（共存验证）

### Documentation
- [ ] spec.md technical solution filled
- [ ] JSON-RPC 生命周期文档化（各 agent 差异表）
