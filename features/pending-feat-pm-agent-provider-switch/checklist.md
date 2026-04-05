# Checklist: feat-pm-agent-provider-switch

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] runtimeId 动态切换不丢失聊天历史
- [ ] PM / Req Agent 独立 provider 覆盖

### Code Quality
- [ ] Code style follows conventions (React.FC, cn(), TypeScript)
- [ ] 无新依赖引入
- [ ] 不修改 Settings 持久化逻辑
- [ ] 兼容 dev mode

### Testing
- [ ] Unit tests written (if needed)
- [ ] Tests passing
- [ ] 手动验证：Settings 默认 provider 生效
- [ ] 手动验证：聊天区下拉切换生效
- [ ] 手动验证：未配置 API Key 时有警告提示

### Documentation
- [ ] spec.md technical solution filled
- [ ] spec.md acceptance criteria verified
