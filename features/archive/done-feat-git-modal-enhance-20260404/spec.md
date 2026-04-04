# Feature: feat-git-modal-enhance Git 弹窗内容增强

## Basic Information
- **ID**: feat-git-modal-enhance
- **Name**: Git 弹窗内容增强（全貌展示 + 可拖拽调整）
- **Priority**: 50
- **Size**: M
- **Dependencies**: feat-git-modal-compact (已完成)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description
强化主页 Git 按钮弹窗，展示本地 Git 仓库的全貌信息（tags、commit 历史、分支列表、详细文件变更、feature 工作流记录），同时将弹窗改为可拖拽、可调整大小的交互模式。

## User Value Points

### VP1: Git 仓库全貌展示
展示丰富的 Git 仓库信息，用户无需打开终端即可了解仓库状态全貌：
- **Tags 列表**：显示所有 Git tags（特别是 feature-workflow 归档标签）
- **Commit 历史**：最近 N 条 commit 记录（消息、作者、时间、hash）
- **分支列表**：本地分支 + 当前分支高亮
- **Feature 工作流记录**：从 queue.yaml 的 completed 列表中提取已归档 feature，与 Git tags 关联展示
- **文件变更增强**：保留现有 stage/unstage 功能，增加 diff 统计摘要

### VP2: 弹窗交互增强
弹窗尺寸和交互方式升级，适应更多内容的展示需求：
- **更大默认尺寸**：宽度从 max-w-lg(512px) 增大到 max-w-4xl(896px)
- **可拖拽移动**：通过拖拽标题栏移动弹窗位置
- **可调整大小**：通过拖拽右下角手柄调整弹窗宽高
- **内容分组折叠**：各信息区块可独立折叠/展开

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:756-1148` — 现有 Git Modal
- `neuro-syntax-ide/src/lib/useGitStatus.ts` — Git 状态 hook
- `neuro-syntax-ide/src/types.ts:87-99` — GitStatusResult, FileDiffInfo 类型
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:247-293` — TaskBoard Modal 拖拽实现参考
- `src-tauri/src/lib.rs` — Tauri Git Commands (fetch_git_status, fetch_git_stats)
- `feature-workflow/queue.yaml` — Feature 工作流队列数据源

### Related Documents
- `project-context.md` — 项目架构和设计系统
- `CLAUDE.md` — Tauri V2 + React 技术栈约束

### Related Features
- `feat-git-modal-compact` (已完成) — Git 弹窗布局优化
- `feat-git-integration` (已完成) — Git 基础集成（status/stage/commit/push-pull）

## Technical Solution

### Tauri 后端新增 Commands（lib.rs）
1. `fetch_git_tags` — 使用 `git2::Repository::tag_foreach` 遍历所有 tags，peel 到 commit 获取时间戳和消息。返回 `Vec<GitTag>` (name, date, commit_hash, message)
2. `fetch_git_log` — 使用 `git2::Repository::revwalk` 从 HEAD 遍历最近 N 条 commit。返回 `Vec<GitCommitDetail>` (hash, short_hash, message, author, timestamp, time_ago)
3. `fetch_git_branches` — 使用 `git2::Repository::branches(Local)` 遍历本地分支。返回 `Vec<GitBranchInfo>` (name, is_current, latest_commit, latest_commit_hash)

### 前端类型（types.ts）
- `GitTag` { name, date(number), commit_hash, message }
- `GitCommit` { hash, short_hash, message, author, timestamp, time_ago }
- `GitBranch` { name, is_current, latest_commit, latest_commit_hash }
- `GitModalTab` = 'overview' | 'branches' | 'tags' | 'history' | 'changes' | 'features'

### 前端 Hook（useGitDetail.ts）
- `useGitDetail()` — 并行调用 fetch_git_tags/fetch_git_log/fetch_git_branches
- 提供 refreshAll() 和 loadMoreCommits(skip)
- 非Tauri 环境使用 mock 数据
1. `fetch_git_tags` — 获取所有 tags（名称、日期、关联 commit）
2. `fetch_git_log` — 获取最近 N 条 commit 记录
3. `fetch_git_branches` — 获取本地分支列表

### 前端改动
1. 新增 `useGitDetail` hook 或扩展 `useGitStatus`
2. 扩展 `types.ts` Git 相关类型（GitTag, GitCommit, GitBranch）
3. 重构 Git Modal 为更大的多分区布局
4. 实现拖拽移动（参考 TaskBoard Modal）
5. 实现边缘/角落拖拽调整大小
6. 添加 Feature 工作流记录读取（从 queue.yaml）

### UI 布局
```
┌─────────────────────── Git Status ────────────────────────┐
│ [拖拽标题栏]                                    [—][□][×] │
├──────────┬───────────────────────────────────────────────┤
│ 侧边导航 │                主内容区                        │
│          │                                               │
│ ○ 概览   │  [当前分区内容：概览/分支/Tags/历史/变更/Feature] │
│ ○ 分支   │                                               │
│ ○ Tags   │                                               │
│ ○ 历史   │                                               │
│ ○ 变更   │                                               │
│ ○ Feature│                                               │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│ [Commit 输入框]                          [Commit] [Push]  │
└──────────────────────────────────────────── [↘ resize] ──┘
```

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在主页 Git 弹窗中看到仓库的完整信息（tags、commit 历史、分支、feature 记录），并能自由调整弹窗大小和位置，以便高效管理项目。

### Scenarios (Given/When/Then)

#### Scenario 1: 查看 Tags 列表
```gherkin
Given 用户打开 Git 弹窗
When 用户点击 "Tags" 分区
Then 显示所有 Git tags 列表
And 每个 tag 显示名称、创建日期、关联 commit 消息
And feature-workflow 归档 tag（如 feat-xxx-20260403）标记为 Feature 标签
```

#### Scenario 2: 查看 Commit 历史
```gherkin
Given 用户打开 Git 弹窗
When 用户点击 "历史" 分区
Then 显示最近 20 条 commit 记录
And 每条显示：short hash、消息、作者、相对时间
And 支持滚动加载更多
```

#### Scenario 3: 查看 Feature 工作流记录
```gherkin
Given 用户打开 Git 弹窗
When 用户点击 "Feature" 分区
Then 从 queue.yaml 读取已完成的 feature 列表
And 显示 feature 名称、完成时间、关联 Git tag
And 点击可展开查看 feature 详情
```

#### Scenario 4: 拖拽移动弹窗
```gherkin
Given Git 弹窗已打开
When 用户按住标题栏拖拽
Then 弹窗跟随鼠标移动
And 弹窗不会移出视口边界
```

#### Scenario 5: 拖拽调整弹窗大小
```gherkin
Given Git 弹窗已打开
When 用户拖拽右下角 resize 手柄
Then 弹窗宽高实时跟随调整
And 最小宽度不低于 600px，最小高度不低于 400px
```

#### Scenario 6: 分支列表展示
```gherkin
Given 用户打开 Git 弹窗
When 用户查看概览或点击 "分支" 分区
Then 显示所有本地分支
And 当前分支高亮标记
And 显示分支的最后一次 commit 消息
```

### UI/Interaction Checkpoints
- 弹窗默认宽度增大至 max-w-4xl
- 左侧导航栏 + 右侧内容区的双栏布局
- 标题栏支持拖拽（mousedown/mousemove/mouseup）
- 右下角 resize 手柄（视觉提示 + 拖拽逻辑）
- 各分区内容可折叠/展开
- 保持现有 stage/commit/push/pull 功能完整

### General Checklist
- 不破坏现有 Git 功能（stage/commit/push/pull）
- 复用现有设计系统（glass-panel、颜色主题、字体）
- 类型定义集中在 types.ts
- 使用 cn() 合并样式
