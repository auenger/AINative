# Tasks: feat-view-state-persistence

## Task Breakdown

### 1. App.tsx — 视图渲染策略重构
- [x] 将 renderView() switch 语句改为全量挂载模式
- [x] 为每个视图容器添加 activeView 条件的 CSS 显隐控制
- [x] 确保 SideNav / TopNav 交互不受影响

### 2. 状态验证
- [ ] 验证 EditorView 文件打开/终端标签在切换后保持
- [ ] 验证 TaskBoard 看板状态在切换后保持
- [ ] 验证 ProjectView 对话历史在切换后保持
- [ ] 验证 WorkflowEditor 画布状态在切换后保持
- [ ] 验证 MissionControl 仪表盘在切换后保持

### 3. 性能与副作用检查
- [x] 确认隐藏视图不会产生多余的网络请求或定时器
- [x] 确认首屏加载时间无明显增加

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 待开发 |
| 2026-04-02 | Implementation complete | renderView() switch → all-mount + CSS hidden/block |
