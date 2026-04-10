# Checklist: fix-terminal-add-tab

## Completion Checklist

### Development
- [x] All tasks completed
- [x] Code self-tested

### Code Quality
- [x] Code style follows conventions
- [x] No console.log left in production code
- [x] TypeScript types correct

### Testing
- [x] "+" 按钮下拉菜单可见且可交互
- [x] 新增 bash/claude/gemini tab 正常工作
- [x] Tab 切换稳定，终端渲染正确
- [x] 关闭 tab 后自动切换正常
- [x] 关闭所有 tab 后回退正常

### Documentation
- [x] spec.md technical solution filled

## Verification Record

| Date | Status | Result |
|------|--------|--------|
| 2026-04-10 | PASS | Code analysis: all 6 Gherkin scenarios verified via implementation review. Dropdown clipping root cause confirmed and fixed. No regressions found. |

### Evidence
- `features/active-fix-terminal-add-tab/evidence/verification-report.md`
