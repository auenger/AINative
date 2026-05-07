# Checklist: feat-sdk-runtime-config

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested

### Code Quality
- [ ] SdkRuntimeConfig struct 独立定义，不污染现有 AppSettings
- [ ] config_mode 枚举值明确（claude-config / custom-provider）
- [ ] Custom Provider 模式注入 ANTHROPIC_MODEL 环境变量
- [ ] Claude Config 模式零注入

### Testing
- [ ] Claude Config 模式正常工作
- [ ] Custom Provider 模式 model 覆盖生效
- [ ] Provider protocol 不兼容时正确拒绝
- [ ] 模式切换无需重启

### Documentation
- [ ] spec.md technical solution filled
- [ ] sdk_runtime 配置字段文档化
