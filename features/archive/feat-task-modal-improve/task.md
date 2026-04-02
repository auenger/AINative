# Tasks: feat-task-modal-improve

## Task Breakdown

### 1. Modal 尺寸约束 (TaskBoard.tsx:564-580)
- [x] 给 modal 容器添加 `max-h-[85vh]` 限制默认高度
- [x] 调整 `minHeight` 和初始尺寸为合理默认值
- [x] 放宽或移除 `max-w-2xl`，改为更大的 `max-w-4xl` 或移除限制
- [x] 确保 body 区域可滚动 (`overflow-y-auto`)

### 2. Description Markdown 渲染 (TaskBoard.tsx:626-632)
- [x] 将 modal 中的 Description `<p>` 标签替换为 `<MarkdownRenderer>` 组件
- [x] 卡片列表中的 description 预览 (160-163行) 保持纯文本不变
- [x] 确保 MarkdownRenderer 已正确导入

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 等待开发 |
| 2026-04-02 | Implementation complete | 3 changes: maxHeight, max-w-4xl, MarkdownRenderer for description |
