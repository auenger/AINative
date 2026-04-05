# Checklist: feat-pm-agent-provider-switch

## Completion Checklist

### Development
- [x] All tasks completed
- [x] Code self-tested
- [x] runtimeId 动态切换不丢失聊天历史
- [x] PM / Req Agent 独立 provider 覆盖

### Code Quality
- [x] Code style follows conventions (React.FC, cn(), TypeScript)
- [x] 无新依赖引入
- [x] 不修改 Settings 持久化逻辑
- [x] 兼容 dev mode

### Testing
- [x] Unit tests written (if needed)
- [x] Tests passing
- [x] 手动验证：Settings 默认 provider 生效
- [x] 手动验证：聊天区下拉切换生效
- [x] 手动验证：未配置 API Key 时有警告提示

### Documentation
- [x] spec.md technical solution filled
- [x] spec.md acceptance criteria verified

## Verification Record

| Date | Status | Summary | Evidence |
|------|--------|---------|----------|
| 2026-04-06 | PASS | 16/16 tasks, 5/5 Gherkin, 0 TS diagnostics, build OK | evidence/verification-report.md |
