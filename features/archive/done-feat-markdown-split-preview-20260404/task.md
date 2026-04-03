# Tasks: feat-markdown-split-preview

## Task Breakdown

### 1. Markdown 分栏容器组件
- [x] 创建 `MarkdownSplitView` 组件（左 Monaco + 右预览）
- [x] 实现可拖拽的分隔条组件 `ResizableSplit`
- [x] 管理左右面板宽度比例 state（默认 50:50）

### 2. Markdown 实时预览
- [x] 使用 react-markdown 渲染右栏内容
- [x] 配置 remark-gfm 插件（表格、删除线等 GFM 扩展）
- [x] 编辑器内容变更时同步更新预览
- [x] 预览区样式与项目设计系统对齐（深色/浅色主题）

### 3. 预览区样式
- [x] 为 Markdown 预览编写 CSS（标题层级、代码块、列表、引用、链接、图片、表格）
- [x] 预览区代码块语法高亮（可选：rehype-highlight 或自定义）
- [x] 深色/浅色主题下预览样式适配

### 4. 滚动联动
- [x] 左栏编辑器滚动时同步右栏预览滚动
- [x] 基于行号/标题锚点映射实现粗略联动

### 5. EditorView 集成
- [x] 在 EditorView 渲染区根据 `rendererType === 'markdown'` 使用 `MarkdownSplitView`

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature initialized |
| 2026-04-04 | Implemented | All 5 tasks completed: MarkdownSplitView component, resizer, real-time preview with remark-gfm, scroll sync, EditorView integration |
