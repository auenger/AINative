# Tasks: feat-image-config-preview

## Task Breakdown

### 1. 图片预览组件
- [x] 创建 `ImagePreview` 组件
- [x] 支持 PNG/JPG/GIF/WebP 显示
- [x] 图片自适应缩放（fit within container）
- [x] 棋盘格背景（透明图片显示）
- [x] 显示图片尺寸和文件大小信息
- [x] 鼠标滚轮缩放支持

### 2. SVG 预览
- [x] 创建 `SvgPreview` 组件（集成在 ImagePreview 中）
- [x] 安全渲染 SVG（剥离 script 标签）
- [x] SVG 自适应缩放

### 3. 配置文件结构化视图
- [x] 创建 `ConfigTreeView` 组件
- [x] JSON 树形渲染（折叠/展开节点）
- [x] YAML 树形渲染
- [x] TOML 树形渲染
- [x] 编辑/结构化视图切换按钮

### 4. EditorView 集成
- [x] 在渲染区根据 `rendererType` 使用 `ImagePreview` 或 `ConfigTreeView`
- [x] 图片文件通过 Tauri 读取为 base64 或使用文件 URL

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature initialized |
| 2026-04-04 | Implemented | All tasks completed: ImagePreview, ConfigTreeView, EditorView integration, read_file_base64 Tauri command |
