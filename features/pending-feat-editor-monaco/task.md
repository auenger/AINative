# Tasks: feat-editor-monaco

## Task Breakdown

### 1. Monaco Editor 集成
- [x] 安装 @monaco-editor/react
- [x] EditorView 中央区域替换 pre/code 为 Monaco Editor 组件
- [x] 配置深色主题 (与原型设计系统一致)
- [x] 语言映射: 按文件扩展名设置 Monaco language
- [x] 编辑器配置: 字体 JetBrains Mono, 行号, 代码折叠

### 2. 多 Tab 管理
- [x] 实现 Tab 状态管理 (openFiles Map)
- [x] 双击文件树 → 打开新 Tab / 切换到已有 Tab
- [x] Tab 标签显示文件名 + 修改标记 (圆点)
- [x] Tab 关闭逻辑 (未保存提示)
- [x] Tab 切换保持光标和滚动状态

### 3. 文件读写
- [ ] Rust: 实现 `read_file` command
- [ ] Rust: 实现 `write_file` command (原子操作)
- [x] 前端: Cmd+S 快捷键绑定
- [x] 保存成功/失败反馈 (状态栏提示)
- [ ] 外部文件变更感知 (结合 Watcher)

### 4. 验证
- [ ] 打开多种文件类型正确高亮 (.ts, .rs, .yaml, .md)
- [ ] 编辑保存后 git diff 验证内容正确
- [ ] 多 Tab 切换流畅
- [ ] 大文件加载性能可接受

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | 前端集成完成 | Monaco Editor 替换 pre/code；多 Tab 管理；Cmd+S 保存；Tauri IPC read_file/write_file 前端侧就绪 (Rust command 待 Phase 2 实现) |
| 2026-04-01 | Created | Feature 规划完成，等待开发 |
