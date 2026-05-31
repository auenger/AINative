# Checklist: feat-rig-builtin-agent-tools

## Completion Checklist

### Development
- [ ] 所有 tasks 完成
- [ ] 代码自测通过

### Code Quality
- [ ] Tool 定义遵循 Rig `Tool` trait 约定
- [ ] 安全约束全面（路径/命令/Git）
- [ ] 错误信息用户友好

### Testing
- [ ] 6 个 Tool 单元测试
- [ ] 路径安全防护测试
- [ ] Shell 危险命令拦截测试
- [ ] 多轮 tool_use 端到端测试

### Documentation
- [ ] spec.md 技术方案已填写
- [ ] Tool 列表和使用说明记录
