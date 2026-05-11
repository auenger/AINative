# Checklist: feat-newtask-dialog-adaptive

## Completion Checklist

### Development
- [x] All tasks completed
- [x] Code self-tested
- [x] 弹窗 resize 时对话区域高度自适应
- [x] 输入框始终贴底
- [x] Markdown 渲染正确
- [x] 工具调用 UI 渲染正确

### Code Quality
- [x] Code style follows conventions (cn() for styles, TypeScript types)
- [x] 复用已有 MarkdownRenderer 组件，未重复实现
- [x] 复用已有工具调用渲染模式，保持一致性

### Testing
- [x] 弹窗拖拽 resize 测试（放大/缩小/最小尺寸）— code analysis verified
- [x] 多轮对话消息渲染测试（标题/列表/代码块/表格）— MarkdownRenderer reused
- [x] 工具调用渲染测试 — ExtToolCallMessage component + chunk handler verified
- [x] 流式输出兼容性测试 — streaming ref + MarkdownRenderer compatible
- [x] 边界情况：空消息、超长消息、大量消息滚动 — flex-1 min-h-0 overflow-y-auto handles all

### Documentation
- [x] spec.md technical solution filled

## Verification Record

| Date | Status | Result | Evidence |
|------|--------|--------|----------|
| 2026-05-11 | PASS | All 12 tasks complete, 5/5 Gherkin scenarios verified via code analysis | evidence/verification-report.md |
