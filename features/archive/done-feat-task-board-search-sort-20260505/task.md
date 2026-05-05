# Tasks: feat-task-board-search-sort

## Task Breakdown

### 1. 搜索功能
- [x] 在 TaskBoard.tsx 添加搜索状态 (`searchQuery`) 和过滤逻辑 (`useMemo`)
- [x] 在 Board 视图顶部渲染搜索输入框（Search icon + input + 清除按钮）
- [x] 实现多关键词 AND 匹配的模糊过滤（匹配 id 和 name）
- [x] 搜索结果匹配文本高亮

### 2. 排序功能
- [x] 添加排序状态 (`sortMode`) 和排序逻辑 (`useMemo`)
- [x] 渲染排序下拉选择器（Priority 降序/升序、时间 降序/升序）
- [x] 实现 priority 排序（保持现有默认行为）
- [x] 实现时间排序（pending/active/blocked 用 created_at，completed 用 completed_at）

### 3. 整合与 UI
- [x] 搜索 + 排序联合工作（过滤后的结果仍按排序规则排列）
- [x] 工具栏样式对齐设计系统（glass-panel）
- [x] List 视图也应用搜索和排序
- [x] Graph 视图隐藏工具栏

### 4. i18n
- [x] 在 i18n.ts 添加中英文翻译 key

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-05 | Feature created | 需求分析完成，文档创建 |
| 2026-05-05 | Implementation complete | 所有 12 个子任务完成，TS 编译通过 |
