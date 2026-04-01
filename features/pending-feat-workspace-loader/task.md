# Tasks: feat-workspace-loader

## Task Breakdown

### 1. Rust 工作区管理
- [ ] 实现 `pick_workspace` command (调用 @tauri-apps/plugin-dialog)
- [ ] 验证工作区有效性 (检查 feature-workflow/ 目录)
- [ ] 实现 `get_stored_workspace` command (读取持久化路径)
- [ ] 工作区路径持久化 (AppData config 文件)
- [ ] 实现 `read_file_tree` command (递归扫描, 生成 FileNode[] JSON)
- [ ] 大型目录性能优化 (最大深度限制, 懒加载支持)

### 2. 前端集成
- [ ] 安装 @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs
- [ ] ProjectView 添加 "Open Project" 按钮
- [ ] EditorView 文件树数据源替换为 invoke('read_file_tree')
- [ ] 文件树展开/折叠交互优化
- [ ] 文件树搜索过滤功能
- [ ] 状态栏显示当前工作区路径

### 3. 验证
- [ ] 选择工作区后文件树正确渲染
- [ ] 重启应用后自动加载工作区
- [ ] 大型项目 (1000+ 文件) 性能测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，等待开发 |
