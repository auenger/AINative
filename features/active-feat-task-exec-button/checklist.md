# Checklist: feat-task-exec-button
## Completion Checklist
### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] Board view pending card 显示 Run 按钮
- [ ] Split parent 按钮 disabled
- [ ] 文档不全按钮 disabled + tooltip
- [ ] 非 pending 状态不显示按钮
- [ ] ExecutionDialog 正确渲染 runtime 列表
- [ ] 确认执行后 /run-feature 被正确调用
- [ ] Overlay 状态流转正确

### Code Quality
- [ ] Code style follows conventions（cn() + Tailwind）
- [ ] 无新 npm 依赖
- [ ] 复用现有 hooks（useAgentRuntimes / useQueueData）

### Testing
- [ ] 手动测试：完整 pending task 流程
- [ ] 手动测试：split parent 禁用
- [ ] 手动测试：文档不全禁用
- [ ] 手动测试：Agent 选择切换

### Documentation
- [ ] spec.md technical solution filled
