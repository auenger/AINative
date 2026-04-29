# Tasks: feat-git-tab-page
## Task Breakdown
### 1. 类型与导航注册
- [ ] types.ts 新增 ViewType 'git'
- [ ] SideNav.tsx 新增 Git 图标导航项
- [ ] App.tsx 注册 GitView 组件渲染

### 2. GitView 组件提取
- [ ] 创建 `components/views/GitView.tsx`
- [ ] 从 ProjectView 提取 Git Modal 全部状态和逻辑
- [ ] 从 ProjectView 提取 7 个子标签页的渲染内容
- [ ] 复用 useGitStatus 和 useGitDetail hooks
- [ ] 复用 CommitGraphTab 组件（如已独立）

### 3. 全屏布局优化
- [ ] Overview 标签：更大状态卡片 + 统计信息
- [ ] History 标签：更多提交记录展示
- [ ] Changes 标签：左右分栏布局（文件列表 | 操作面板）
- [ ] 其他标签适配全屏宽度

### 4. ProjectView 清理
- [ ] ProjectView 中 Git Modal 按钮改为 setActiveView('git')
- [ ] 移除 ProjectView 中 Git Modal 相关代码（状态/事件处理/渲染）
- [ ] 移除拖拽/调整大小逻辑
- [ ] 验证 ProjectView 其他功能不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Created | 任务拆解完成 |
