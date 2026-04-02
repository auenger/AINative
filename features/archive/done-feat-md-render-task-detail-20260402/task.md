# Tasks: feat-md-render-task-detail

## Task Breakdown

### 1. MarkdownRenderer 组件
- [x] 创建 `MarkdownRenderer.tsx` 组件，封装 react-markdown
- [x] 配置自定义组件映射（headings, lists, code blocks, tables, checkboxes, links）
- [x] 添加深色主题 prose 样式，适配项目设计系统

### 2. TaskBoard 弹窗改造
- [x] 将弹窗宽度从 max-w-xl 增大到 max-w-2xl
- [x] 将 spec.md `<pre>` 标签替换为 MarkdownRenderer
- [x] 添加 Tab 切换组件（Spec / Tasks / Checklist）
- [x] 接入 task.md 和 checklist.md 内容渲染
- [x] 处理空状态（无对应文件时的提示）

### 3. 样式适配
- [x] Markdown prose 深色主题样式
- [x] 代码块样式（JetBrains Mono 字体、背景色）
- [x] 表格样式（边框、斑马纹）
- [x] 复选框样式（checked / unchecked）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | Ready for implementation |
