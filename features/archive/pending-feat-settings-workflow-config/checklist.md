# Checklist: feat-settings-workflow-config

## Completion Checklist

### Development
- [ ] 所有 tasks completed
- [ ] Code self-tested
  - [ ] Workflow Tab 正确显示 config.yaml 参数
  - [ ] 修改参数后保存成功写入文件
  - [ ] 重置功能正常
  - [ ] dirty state 切换提示正常

### Code Quality
- [ ] Code style follows conventions（Tailwind CSS + cn()）
- [ ] 类型定义集中在 types.ts
- [ ] 复用现有 useSettings Hook 模式
- [ ] 无硬编码敏感信息

### Testing
- [ ] 手动验证所有 Toggle 开关
- [ ] 手动验证数字输入边界（1-5）
- [ ] 手动验证保存/重置流程
- [ ] 暗色/亮色主题视觉检查

### Documentation
- [ ] spec.md technical solution filled
- [ ] 变更点在 task.md 中记录
