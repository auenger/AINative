# Tasks: feat-editor-theme-perf

## Task Breakdown

### 1. Monaco 自定义主题
- [x] 定义 `neuro-dark` Monaco 主题（colors + token rules），对齐 index.css 设计系统
- [x] 在 Monaco loader `beforeMount` 中注册自定义主题
- [x] 将 EditorView 中 `theme="vs-dark"` 替换为 `theme="neuro-dark"`

### 2. 渲染性能优化
- [x] 审查 EditorView 中 openFile/handleEditorDidMount 的 re-render 问题
- [x] Monaco 容器添加 CSS fallback 背景色防白闪
- [x] 实现深色 loading skeleton 替代 Suspense fallback 白屏
- [x] 考虑 Monaco worker 预加载策略（lazy-load 保持不变，通过 beforeMount 提前注册主题）

### 3. 验证与测试
- [ ] 手动验证多类型文件（ts/rs/md/yaml/css）语法高亮效果
- [ ] 验证文件切换无白闪
- [ ] 验证大文件加载表现

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Created | Feature created from split |
| 2026-04-02 | Implemented | Theme definition, performance optimization, dark skeleton |
