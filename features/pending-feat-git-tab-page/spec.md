# Feature: feat-git-tab-page Git 独立 Tab 页

## Basic Information
- **ID**: feat-git-tab-page
- **Name**: Git 独立 Tab 页
- **Priority**: 85
- **Size**: S
- **Dependencies**: null
- **Parent**: feat-git-tab-redesign
- **Children**: []
- **Created**: 2026-04-27

## Description
将 ProjectView 中嵌入的 Git Modal（约 2400+ 行）提取为独立的顶级 Tab 页面。新增 ViewType `git`，在 SideNav 添加 Git 导航图标，创建独立的 GitView 组件，利用全屏空间重新布局 Git 功能。保留原有 7 个子标签页的所有功能。

## User Value Points
1. **全屏 Git 管理** — 不再受弹窗空间限制，所有 Git 信息一目了然
2. **随时访问** — 从任何页面一键切换到 Git Tab，无需先进入 Project 页

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 当前 Git Modal 实现（lines 1794-2438）
  - Git Modal 状态管理（lines 356-377）
  - 7 个标签页内容（Overview/Branches/Tags/History/Changes/Features/Graph）
  - 拖拽/调整大小逻辑（lines 580-635）
  - Git 操作函数（commit/push/pull/stage/unstage，lines 637-717）
- `neuro-syntax-ide/src/components/SideNav.tsx` — 侧栏导航，需新增 Git 图标
- `neuro-syntax-ide/src/types.ts` — ViewType 定义，需新增 'git'
- `neuro-syntax-ide/src/App.tsx` — 主路由，需新增 GitView 渲染
- `neuro-syntax-ide/src/lib/useGitStatus.ts` — Git Status Hook（可复用）
- `neuro-syntax-ide/src/lib/useGitDetail.ts` — Git Detail Hook（可复用）
- `neuro-syntax-ide/src/components/views/MissionControl.tsx` — 参考独立 Tab 页实现模式

### Related Documents
- project-context.md

### Related Features
- feat-git-branch-graph（已完成）— CommitGraphTab 组件
- feat-git-tag-expand（已完成）— Tag 展开功能

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望 Git 管理是独立的 Tab 页面，让我可以全屏查看和操作 Git，不被弹窗空间限制。

### Scenarios (Given/When/Then)

#### 场景 1：导航到 Git Tab
```gherkin
Given 用户在 Neuro Syntax IDE 任意页面
When 用户点击侧栏的 Git 图标
Then 切换到独立的 Git Tab 页面
And 页面标题显示当前分支名和仓库状态
And 侧栏 Git 图标高亮为选中状态
```

#### 场景 2：Git Tab 功能完整性
```gherkin
Given 用户打开 Git Tab 页面
Then 保留原有 7 个子标签页（Overview/Branches/Tags/History/Changes/Features/Graph）
And 所有 Git 操作（commit/push/pull/stage/unstage）正常工作
And Commit Graph Timeline 正常渲染
And Tag 展开和详情加载正常
```

#### 场景 3：ProjectView Git 按钮重定向
```gherkin
Given 用户在 Project 页面
When 点击原来的 Git 弹窗按钮
Then 切换到独立的 Git Tab 页面
And 不再弹出 Git Modal
```

#### 场景 4：全屏布局优化
```gherkin
Given 用户在 Git Tab 页面
Then 利用全屏空间展示内容
And Overview 标签显示更大的分支状态卡片和统计信息
And History 标签显示更多提交记录
And Changes 标签左右分栏展示文件列表和操作面板
```

### UI/Interaction Checkpoints
- SideNav 新增 Git 图标（使用 GitBranch 或 GitCommit 图标，位于 Settings 图标上方）
- Git Tab 顶部保留 7 个子标签切换
- Overview 布局优化：更大的状态卡片
- Changes 布局优化：左右分栏（文件列表 | 操作面板）
- 响应式：窗口缩小时自动调整布局

### General Checklist
- [ ] ViewType 新增 'git'
- [ ] GitView 组件创建，从 ProjectView 提取 Git 相关代码
- [ ] SideNav 新增 Git 导航项
- [ ] App.tsx 注册 GitView
- [ ] ProjectView 中 Git 按钮重定向到 Git Tab
- [ ] ProjectView 中移除 Git Modal 相关代码（约 600+ 行）
