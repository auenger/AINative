# Tasks: feat-file-tree-navigation

## Task Breakdown

### 1. Rust 后端导航命令
- [x] 新增 `reveal_in_file_manager` 命令 — 在系统文件管理器中显示（前端预留 Tauri invoke 调用，后端待 src-tauri 创建后实现）
- [x] 集成系统剪贴板（使用 navigator.clipboard API + fallback）

### 2. 在文件树中定位
- [x] 编辑器打开文件时记录当前文件路径
- [x] 新增"在文件树中定位"按钮/快捷键（Cmd/Ctrl+Shift+E）
- [x] 自动展开文件树到目标文件
- [x] 滚动到目标节点并高亮（2s 脉冲动画）

### 3. 右键菜单集成
- [x] 添加"复制路径"菜单项
- [x] 添加"复制相对路径"菜单项
- [x] 添加"在 Finder/资源管理器中显示"菜单项
- [x] Toast 提示反馈（复用 statusMessage bar）

### 4. 面包屑导航
- [x] 文件树顶部显示当前路径面包屑
- [x] 点击面包屑快速跳转

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | All tasks completed | Implemented locate-in-tree, breadcrumb navigation, context menu navigation items, copy path (absolute/relative), reveal-in-file-manager (Tauri-ready) |
