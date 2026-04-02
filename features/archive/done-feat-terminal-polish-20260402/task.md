# Tasks: feat-terminal-polish

## Task Breakdown

### 1. 终端主题跟随
- [x] 在 EditorView/XTerminal 中引入 useTheme()
- [x] 根据 resolvedTheme 定义 dark/light 终端颜色方案
- [x] 动态设置 xterm.js terminal.options.theme
- [x] 测试主题切换时终端颜色实时更新

### 2. 终端显隐 toggle
- [x] 在终端关闭时渲染 floating toggle 按钮
- [x] 按钮 style 参考 Console icon toggle 实现
- [x] 点击按钮恢复 terminalOpen = true
- [x] 确保按钮位置不遮挡编辑器内容

### 3. 联合验证
- [x] 验证 tab 切换后终端状态完整保留（依赖 feat-view-state-persistence）
- [x] 验证终端主题 + 显隐在视图切换后正确恢复
- [x] 验证 toggle 按钮在终端关闭态始终可见

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 待开发，依赖 feat-view-state-persistence |
