# Tasks: feat-console-icon-toggle

## Task Breakdown

### 1. App.tsx — 默认状态修改
- [ ] 将 `consoleVisible` 初始值从 `true` 改为 `false`

### 2. BottomPanel.tsx — 折叠态改为小图标
- [ ] 移除全宽 28px 折叠条（visible=false 时的全宽 button）
- [ ] 在折叠态时渲染一个定位在右下角的小图标按钮
- [ ] 图标使用 Terminal icon，hover 有提示文字
- [ ] 点击图标调用 `onOpen` 展开面板

### 3. 样式调整
- [ ] 折叠态 footer 高度变为 0（不占用空间）
- [ ] 小图标使用 absolute 定位，浮在内容区右下角
- [ ] 确保 StatusBar 不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 等待开发 |
