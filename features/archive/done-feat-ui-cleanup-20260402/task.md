# Tasks: feat-ui-cleanup

## Task Breakdown

### 1. 移除 Mock 文件标签 (TopNav.tsx)
- [x] 删除 TopNav.tsx 中 Main.ts、System.py、Workflow.node 三个 mock tab 元素
- [x] 删除分隔线元素
- [x] 验证 Header 布局无异常

### 2. 修复 Logo 被遮挡 (TopNav.tsx + SideNav.tsx)
- [x] 调整 TopNav 添加左内边距避开 SideNav 区域
- [x] 验证 SideNav 的顶部 padding 与 TopNav 高度匹配
- [ ] 确保 SideNav 中可放置小型 logo icon（可选）
- [x] 验证 logo 在不同窗口宽度下正常显示

### 3. Console 面板可折叠 (BottomPanel.tsx + App.tsx)
- [x] 在 App.tsx 添加 consoleVisible state
- [x] 修改 BottomPanel 接收 visible 和 onClose props
- [x] Console 关闭时平滑折叠动画 (CSS transition)
- [x] 添加右下角浮动 Terminal 图标按钮
- [x] 点击浮动按钮重新显示 Console
- [x] 验证折叠/展开不影响主内容区布局

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 等待开发 |
| 2026-04-02 | Implementation complete | All 3 tasks implemented, build passes |
