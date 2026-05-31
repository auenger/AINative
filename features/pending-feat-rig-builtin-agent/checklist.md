# Checklist: feat-rig-builtin-agent

## Completion Checklist

### Development
- [ ] 所有子 Feature 已完成
  - [ ] feat-rig-builtin-agent-core
  - [ ] feat-rig-builtin-agent-provider
  - [ ] feat-rig-builtin-agent-tools
- [ ] 集成测试通过

### Code Quality
- [ ] 代码风格遵循项目约定
- [ ] RigRuntime 实现符合 AgentRuntime trait 接口
- [ ] 不破坏现有 ClaudeCodeRuntime / AgentSdkRuntime 功能

### Testing
- [ ] 单元测试覆盖 Rig 核心逻辑
- [ ] 流式响应端到端测试
- [ ] Multi-Provider 切换测试

### Documentation
- [ ] spec.md 技术方案已填写
- [ ] Rig 依赖说明已更新到 CLAUDE.md
