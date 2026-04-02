# Tasks: feat-console-collapse-strip

## Task Breakdown

### 1. BottomPanel 组件改造
- [x] 添加折叠横条状态（collapsed strip，高度 ~28-32px）
- [x] 折叠时显示横条内含 Terminal icon + 可选标签文字
- [x] 移除旧的 max-h-0 完全折叠逻辑
- [x] 确保过渡动画平滑（展开 ↔ 折叠横条）

### 2. App.tsx 浮动按钮移除
- [x] 删除 `!consoleVisible` 条件渲染的浮动 Terminal 按钮
- [x] 确认 BottomPanel 自身处理展开/折叠的完整交互

### 3. 布局验证
- [x] 验证所有视图（Project/Editor/Tasks/Workflow/Mission Control）下的高度正确
- [x] 确认横条不与 StatusBar 重叠
- [x] 确认内容区域不被遮挡

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | All tasks completed | BottomPanel collapsed strip + removed floating button in App.tsx |
