# Feature: feat-git-tab-redesign Git 独立 Tab 页面重设计

## Basic Information
- **ID**: feat-git-tab-redesign
- **Name**: Git 独立 Tab 页面重设计
- **Priority**: 80
- **Size**: L
- **Dependencies**: null
- **Parent**: null
- **Children**: [feat-git-tab-page, feat-git-file-interaction, feat-git-display-enhance]
- **Created**: 2026-04-27

## Description
将主页的 Git 弹窗（Modal）升级为独立的顶级 Tab 页面，释放全屏空间用于 Git 操作。同时强化文件变更的交互能力（多选、拖拽、批量操作）和展示效果（Diff 预览、统计可视化、信息层次优化），使 Git 管理体验达到专业 IDE 水平。

## User Value Points
1. **Git 独立 Tab 页** — 从弹窗升级为顶级 ViewType，全屏空间展示所有 Git 信息
2. **文件变更交互增强** — 多选文件、拖拽 staging/unstaging、批量操作
3. **Git 信息展示强化** — Diff 预览、文件变更统计可视化、信息层次优化

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 当前 Git Modal 实现（约 2400+ 行内嵌）
- `neuro-syntax-ide/src/components/SideNav.tsx` — 侧栏导航（需新增 Git Tab 图标）
- `neuro-syntax-ide/src/types.ts` — ViewType 定义（需新增 'git'）
- `neuro-syntax-ide/src/App.tsx` — 主路由（需新增 Git 视图渲染）
- `neuro-syntax-ide/src/lib/useGitStatus.ts` — Git Status Hook
- `neuro-syntax-ide/src/lib/useGitDetail.ts` — Git Detail Hook
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust Git Commands

### Related Documents
- project-context.md — 项目架构说明

### Related Features
- feat-git-branch-graph (已完成) — Branch & Feature 连线图
- feat-git-tag-expand (已完成) — Tag 详情展开

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望 Git 管理界面是独立的 Tab 页面而非弹窗，这样我可以同时浏览代码和 Git 状态，更高效地管理文件变更。

### Scenarios (Given/When/Then)

#### 场景 1：Git Tab 导航
```gherkin
Given 用户在 Neuro Syntax IDE 任意页面
When 用户点击侧栏 Git 图标
Then 切换到独立 Git Tab 页面
And 显示完整的 Git 信息面板
```

#### 场景 2：从 Modal 迁移到 Tab
```gherkin
Given Git 弹窗原有 7 个子标签（Overview/Branches/Tags/History/Changes/Features/Graph）
When 实现为独立 Tab 页后
Then 所有原有功能完整保留
And 布局利用全屏空间进行优化
And ProjectView 中的 Git 弹窗按钮重定向到 Git Tab
```

#### 场景 3：文件多选操作
```gherkin
Given Git Changes 面板显示 5 个未暂存文件
When 用户通过 Shift+点击选中 3 个文件
Then 选中的文件高亮显示
And 点击 Stage 按钮批量暂存选中的文件
```

#### 场景 4：拖拽 Staging
```gherkin
Given Git Changes 面板有未暂存文件
When 用户拖拽 1 个文件到 Staged 区域
Then 该文件立即从 Unstaged 移到 Staged 列表
And Git 状态实时更新
```

#### 场景 5：Diff 预览
```gherkin
Given Git Changes 面板显示文件变更列表
When 用户点击某个变更文件
Then 右侧面板显示该文件的 Diff 预览
And 用颜色标注增删行
```

### UI/Interaction Checkpoints
- SideNav 新增 Git 图标（GitBranch/GitCommit 图标）
- Git Tab 左侧文件列表 + 右侧详情面板的双栏布局
- 拖拽交互需有视觉反馈（拖拽区高亮、放置提示）
- 多选需有 Shift+点击范围选和 Ctrl/Cmd+点击单选
- Diff 预览面板可折叠/展开

### General Checklist
- 所有原 Git Modal 功能迁移完整
- 无功能回归
- 响应式布局适应窗口大小变化
