# Tasks: feat-project-md-explorer

## Task Breakdown

### 1. Tauri Backend — list_md_files Command
- [ ] 在 `src-tauri/src/lib.rs` 新增 `list_md_files` Command
- [ ] 接收目录路径参数，返回该目录下所有 `.md` 文件的名称和路径列表
- [ ] 过滤掉隐藏文件和 node_modules 等目录

### 2. ProjectView 右侧面板重构
- [ ] 在右侧面板内新增 MD 文件列表侧栏（~180px 宽）
- [ ] 通过 `list_md_files` 或 `read_file_tree` 加载文件列表
- [ ] 文件列表项支持点击选中，高亮当前文件
- [ ] 选中文件后通过 `read_file` 加载内容

### 3. 编辑/预览模式切换
- [ ] 在内容区域顶部添加 Edit / Preview 切换按钮
- [ ] 编辑模式：使用 textarea 或 Monaco 编辑器显示 Markdown 原文
- [ ] 预览模式：使用 MarkdownRenderer 组件进行富渲染
- [ ] 模式切换时有平滑过渡效果

### 4. 文件保存功能
- [ ] 编辑模式下支持 Cmd+S 快捷键保存
- [ ] 通过 `write_file` Command 将内容写入文件
- [ ] 保存成功后更新预览内容
- [ ] 显示保存状态（已修改/已保存指示器）

### 5. 空状态和错误处理
- [ ] 无 .md 文件时显示空状态提示
- [ ] 文件加载失败时显示错误信息
- [ ] 保存失败时显示错误提示

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | Feature created | 待开发 |
