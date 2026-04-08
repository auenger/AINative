# Tasks: feat-file-tree-resizable

## Task Breakdown

### 1. 拖拽状态与逻辑
- [x] 在 EditorView 中添加 `sidebarWidth` state（默认 256px）
- [x] 实现 mousedown/mousemove/mouseup 拖拽逻辑（参考终端面板实现）
- [x] 添加最小宽度 150px、最大宽度 500px 约束
- [x] 双击分隔条恢复默认宽度 256px

### 2. 分隔条 UI
- [x] 替换 `w-64` 为动态 `style={{ width: sidebarWidth }}`
- [x] 在文件树和编辑器之间添加拖拽分隔条（2-3px 宽）
- [x] hover 时显示 `col-resize` 光标
- [x] 拖拽中添加 `select-none` 防止文本选中

### 3. 兼容性验证
- [x] 确保 Monaco 编辑器在宽度变化时调用 `layout()` 重绘
- [x] 验证文件树内容在不同宽度下正确显示
- [x] 验证终端面板功能不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | All tasks completed | Added sidebarWidth state, drag logic, resize divider, double-click reset. Monaco automaticLayout handles redraw. |
