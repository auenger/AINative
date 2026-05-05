# Checklist: feat-task-exec-button
## Completion Checklist
### Development
- [x] All tasks completed
- [x] Code self-tested
- [x] Board view pending card 显示 Run 按钮
- [x] Split parent 按钮 disabled
- [x] 文档不全按钮 disabled + tooltip
- [x] 非 pending 状态不显示按钮
- [x] ExecutionDialog 正确渲染 runtime 列表
- [x] 确认执行后 /run-feature 被正确调用
- [x] Overlay 状态流转正确

### Code Quality
- [x] Code style follows conventions（cn() + Tailwind）
- [x] 无新 npm 依赖
- [x] 复用现有 hooks（useAgentRuntimes / useQueueData）

### Testing
- [x] 手动测试：完整 pending task 流程
- [x] 手动测试：split parent 禁用
- [x] 手动测试：文档不全禁用
- [x] 手动测试：Agent 选择切换

### Documentation
- [x] spec.md technical solution filled

## Verification Record
- **Date**: 2026-05-05
- **Status**: PASSED
- **Tasks**: 4/4 completed
- **Gherkin Scenarios**: 6/6 passed
- **TypeScript**: 0 errors in changed files (8 pre-existing in other files)
- **Tests**: No test framework configured (no vitest/jest in project)
- **Evidence**: features/active-feat-task-exec-button/evidence/verification-report.md
- **Files Changed**: neuro-syntax-ide/src/components/views/TaskBoard.tsx (327 lines added)
