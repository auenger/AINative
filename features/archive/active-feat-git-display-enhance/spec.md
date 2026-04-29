# Feature: feat-git-display-enhance Git 信息展示强化

## Basic Information
- **ID**: feat-git-display-enhance
- **Name**: Git 信息展示强化
- **Priority**: 75
- **Size**: S
- **Dependencies**: feat-git-tab-page
- **Parent**: feat-git-tab-redesign
- **Children**: []
- **Created**: 2026-04-27

## Description
强化 Git 页面的信息展示效果：新增文件 Diff 预览面板（点击文件右侧显示 inline diff）、文件变更统计可视化（柱状图/热力图）、信息层次优化（卡片式布局、分区更清晰）、响应式布局适配。让 Git 信息一目了然，达到专业 Git GUI 工具的展示水准。

## User Value Points
1. **Diff 预览** — 点击文件即可预览变更内容，无需切换到编辑器
2. **统计可视化** — 直观的变更统计图表，快速了解改动规模
3. **信息层次优化** — 卡片式布局 + 清晰分区，信息密度高但不杂乱

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Git Modal 全部渲染逻辑
  - Overview 标签：分支状态卡片、统计数据
  - History 标签：提交列表
  - Changes 标签：文件列表
  - Graph 标签：CommitGraphTab 组件
- `neuro-syntax-ide/src-tauri/src/lib.rs` — 现有 Git Commands
- `neuro-syntax-ide/src/types.ts` — Git 相关类型定义

### Related Documents
- project-context.md

### Related Features
- feat-git-tab-page（前置依赖）
- feat-git-file-interaction（协同功能）

## Technical Solution
### Backend (Rust / Tauri Commands)
- **`git_file_diff`**: New Tauri command accepting `path` and `staged` boolean, returns `FileDiffResult` with structured diff lines (type, old/new line numbers, content). Uses `git2::Patch::from_diff` to parse individual file diffs into structured line data.
- **`git_commit_detail`**: New Tauri command accepting `hash`, returns `CommitDetailResult` with file changes and total additions/deletions. Uses `git2::Repository::diff_tree_to_tree` between commit and parent.

### Frontend Components
- **`DiffPanel`**: New component rendering unified diff with line numbers, color-coded additions (green) and deletions (red). Includes header showing file path and +/- stats.
- **`DiffLineRow`**: Individual diff line renderer with proper styling per line type.
- **`StatBarChart`**: Pure CSS bar chart for commit frequency visualization (no chart library).

### State Management
- Extended `useGitDetail` hook with commit expand state (`expandedCommits`, `commitDetails`, `commitLoading`, `toggleCommitExpand`).
- Added diff preview state in GitView (`selectedDiffFile`, `diffResult`, `diffLoading`, `diffError`, `showDiffPanel`).

### UI Enhancements
- Overview tab: Glass-card grid layout, staged/unstaged/untracked stat cards, line change totals, 7-day commit frequency bar chart.
- History tab: Expandable commit items with file change lists, click-to-diff from history.
- Changes tab: Toggleable diff preview panel, responsive md:flex-row layout.
- Tab bar: Horizontal scroll for narrow screens.
- Consistent rounded-xl and backdrop-blur styling across all cards.

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望 Git 页面的信息展示更加直观清晰，点击文件就能看到 Diff，统计信息一目了然。

### Scenarios (Given/When/Then)

#### 场景 1：文件 Diff 预览
```gherkin
Given Git Changes 面板显示文件变更列表
When 用户点击某个变更文件
Then 右侧面板显示该文件的 Diff 预览
And 新增行用绿色背景标注
And 删除行用红色背景标注
And 行号正确显示
```

#### 场景 2：Diff 预览切换
```gherkin
Given 用户正在查看文件 A 的 Diff 预览
When 用户点击另一个文件 B
Then Diff 面板切换为文件 B 的内容
And 文件 A 仍保持选中状态
```

#### 场景 3：变更统计可视化
```gherkin
Given Git Overview 标签页
Then 显示当前分支的变更统计面板
And 用柱状图展示最近 7 天的提交频率
And 用数字显示 staged/unstaged/untracked 文件数
And 用颜色区分 additions（绿）和 deletions（红）
```

#### 场景 4：提交详情展开
```gherkin
Given Git History 标签显示提交列表
When 用户点击某条提交记录
Then 展开显示该提交的详细变更文件列表
And 每个文件显示 additions/deletions 数量
And 可点击文件名查看 Diff
```

#### 场景 5：响应式布局
```gherkin
Given 用户在 Git Tab 页面
When 窗口宽度小于 768px
Then Diff 预览面板从右侧折叠到底部
And 文件列表占满宽度
And 标签页切换变为横向滚动
```

### UI/Interaction Checkpoints
- Diff 面板：等宽字体（JetBrains Mono）、行号、语法高亮（可选）
- 统计卡片：玻璃态风格，与设计系统一致
- 提交展开动画：平滑展开/收起
- 变更统计数字：大字体 + 颜色区分
- 分区清晰：Overview 用卡片网格，History 用时间线，Changes 用分栏

### General Checklist
- [ ] Diff 预览面板实现（需新增 Tauri Command `git_file_diff`）
- [ ] 变更统计可视化
- [ ] 提交详情展开（需新增 Tauri Command `git_commit_detail`）
- [ ] 响应式布局
- [ ] 信息层次优化（卡片式布局）
