# Tasks: feat-git-file-interaction
## Task Breakdown
### 1. 多选逻辑
- [x] 实现 selectedFiles state（Set<string>）
- [x] 点击选择/取消选择单个文件
- [x] Shift+点击范围选择
- [x] Ctrl/Cmd+点击追加选择
- [x] Escape 取消全选
- [x] 选中文件视觉反馈（背景色高亮）

### 2. 拖拽交互
- [x] 文件行添加 draggable 属性
- [x] onDragStart 设置拖拽数据（选中的文件路径）
- [x] 目标区域（Staged/Unstaged）onDragOver 允许放置
- [x] onDragEnter/onDragLeave 高亮目标区域
- [x] onDrop 执行 stage/unstage 操作
- [x] 拖拽时文件行半透明效果

### 3. 批量操作
- [x] 批量操作栏组件（固定底部）
- [x] Stage Selected 按钮
- [x] Unstage Selected 按钮
- [x] Stage All 按钮
- [x] Unstage All 按钮
- [x] 操作中 loading 状态
- [x] 操作结果反馈（toast/inline message）

### 4. 快捷键
- [x] Ctrl/Cmd+A 全选当前分组文件
- [x] Delete/Backspace 丢弃选中文件更改（确认弹窗）
- [x] Enter 暂存选中文件

### 5. 后端支持（如需要）
- [x] 评估是否需要新增 batch_stage_files Tauri Command
- [x] 如需要，在 lib.rs 中实现批量操作

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Created | 任务拆解完成 |
| 2026-04-28 | Implemented | All tasks implemented: multi-select, drag-drop, batch ops, shortcuts, backend batch commands |
