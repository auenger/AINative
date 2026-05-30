# Checklist: feat-agent-provider-core

## Completion Checklist

### Development
- [ ] 所有 task 完成
- [ ] OpenClaw WebSocket 连接可用
- [ ] Hermes 增强功能可用
- [ ] Settings UI 正常显示和切换

### Code Quality
- [ ] WebSocket 消息类型完整定义
- [ ] Provider trait 扩展不影响现有 Pipe/ACP 代码
- [ ] 错误处理覆盖：检测失败、连接超时、断连恢复

### Testing
- [ ] OpenClaw 检测与连接测试
- [ ] Hermes Skill/Memory 功能测试
- [ ] Provider 切换集成测试
- [ ] WebSocket 断连恢复测试

### Documentation
- [ ] spec.md technical solution 填写完整
- [ ] 新增 IPC Commands 文档
