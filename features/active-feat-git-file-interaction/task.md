# Tasks: feat-git-file-interaction
## Task Breakdown
### 1. 多选逻辑
- [ ] 实现 selectedFiles state（Set<string>）
- [ ] 点击选择/取消选择单个文件
- [ ] Shift+点击范围选择
- [ ] Ctrl/Cmd+点击追加选择
- [ ] Escape 取消全选
- [ ] 选中文件视觉反馈（背景色高亮）

### 2. 拖拽交互
- [ ] 文件行添加 draggable 属性
- [ ] onDragStart 设置拖拽数据（选中的文件路径）
- [ ] 目标区域（Staged/Unstaged）onDragOver 允许放置
- [ ] onDragEnter/onDragLeave 高亮目标区域
- [ ] onDrop 执行 stage/unstage 操作
- [ ] 拖拽时文件行半透明效果

### 3. 批量操作
- [ ] 批量操作栏组件（固定底部）
- [ ] Stage Selected 按钮
- [ ] Unstage Selected 按钮
- [ ] Stage All 按钮
- [ ] Unstage All 按钮
- [ ] 操作中 loading 状态
- [ ] 操作结果反馈（toast/inline message）

### 4. 快捷键
- [ ] Ctrl/Cmd+A 全选当前分组文件
- [ ] Delete/Backspace 丢弃选中文件更改（确认弹窗）
- [ ] Enter 暂存选中文件

### 5. 后端支持（如需要）
- [ ] 评估是否需要新增 batch_stage_files Tauri Command
- [ ] 如需要，在 lib.rs 中实现批量操作

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Created | 任务拆解完成 |
