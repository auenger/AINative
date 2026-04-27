# Tasks: feat-file-tree-context-menu

## Task Breakdown

### 1. Rust 后端文件操作命令
- [ ] 新增 `create_file` 命令 — 创建空文件
- [ ] 新增 `create_dir` 命令 — 创建文件夹
- [ ] 新增 `delete_entry` 命令 — 删除文件或文件夹（递归）
- [ ] 新增 `rename_entry` 命令 — 重命名文件或文件夹

### 2. ContextMenu 组件
- [ ] 创建通用 `ContextMenu` 组件（定位、动画、样式）
- [ ] 支持菜单项配置（图标、标签、快捷键、分割线）
- [ ] 点击外部自动关闭

### 3. 文件树右键集成
- [ ] 文件树节点绑定 `onContextMenu` 事件
- [ ] 区分文件/文件夹/空白区域的菜单项
- [ ] 实现新建文件 inline 输入
- [ ] 实现新建文件夹 inline 输入
- [ ] 实现重命名 inline 编辑
- [ ] 实现删除确认对话框

### 4. 文件树刷新机制
- [ ] 操作完成后自动刷新文件树数据
- [ ] 刷新后保持展开状态

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
