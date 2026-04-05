# Feature: feat-git-tag-expand Tag 详情展开

## Basic Information
- **ID**: feat-git-tag-expand
- **Name**: Tag 详情展开（动态加载提交历史与文件变动）
- **Priority**: 65
- **Size**: S
- **Dependencies**: feat-git-modal-enhance (已完成)
- **Parent**: feat-git-tag-detail-graph
- **Children**: []
- **Created**: 2026-04-06

## Description

在 Git 弹窗的 Tags Tab 中，点击某个 Tag 时展开该 Tag 的详细信息，包括：
- 该 Tag 对应的提交历史（从上一个 Tag 到当前 Tag 之间的 commits）
- 涉及的文件变动列表（新增/修改/删除的文件及 diff 统计）
- 采用动态加载策略：只有用户点击展开时才通过 Tauri Command 拉取数据

## User Value Points
1. **Tag 内涵可视化** — 用户不再只看到 Tag 名称和日期，可以深入了解每个 Tag 对应的具体代码变更，便于回顾版本演进和代码审查

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Tags Tab 渲染逻辑 (lines ~1055-1084)
- `neuro-syntax-ide/src/lib/useGitDetail.ts` — Git 详情 Hook (tags/commits/branches)
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust 后端 Git Commands
- `neuro-syntax-ide/src/types.ts` — GitTag 等类型定义

### Related Documents
- Git modal 已有 6 个 Tab：overview / branches / tags / history / changes / features

### Related Features
- feat-git-modal-enhance (已完成) — Git 弹窗内容增强
- feat-git-integration (已完成) — Git 集成功能基础

## Technical Solution

### 前端
1. 在 Tags Tab 的每个 Tag 条目中增加展开/折叠箭头按钮
2. 点击时调用新的 Tauri Command 获取 Tag 对应的 commit 列表和文件变动
3. 展开区域显示：
   - Commit 列表（hash、message、author、time_ago）
   - 文件变动列表（文件路径、状态 added/modified/removed、+/- 行数统计）
4. 使用 React state 管理 expandedTags: Set<string>，避免重复请求（缓存已加载的 Tag 详情）

### 后端 (Rust)
1. 新增 Tauri Command: `fetch_tag_commits(tag_name: String)` → 返回该 Tag 与上一个 Tag 之间的 commit 列表
2. 新增 Tauri Command: `fetch_tag_diff(tag_name: String)` → 返回该 Tag 的 diff stat（文件列表 + 行数变动）
3. 使用 `git2-rs` crate 实现上述功能

### 类型定义
```typescript
interface TagDetail {
  tag_name: string;
  commits: GitCommit[];
  file_changes: TagFileChange[];
}

interface TagFileChange {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望在 Git 弹窗中点击 Tag 展开查看详细的提交和文件变动信息，以便快速了解每个版本的代码变更。

### Scenarios (Given/When/Then)

**Scenario 1: 展开 Tag 查看详情**
```gherkin
Given Git 弹窗已打开且在 Tags Tab
When 用户点击某个 Tag 条目的展开按钮
Then 该 Tag 展开显示提交列表和文件变动列表
And 数据通过 Tauri Command 动态加载（首次点击时请求）
```

**Scenario 2: 折叠已展开的 Tag**
```gherkin
Given 某个 Tag 已展开显示详情
When 用户再次点击该 Tag 的展开按钮
Then 详情区域折叠收起
and 已加载的数据被缓存，再次展开时不需要重新请求
```

**Scenario 3: 动态加载中的 Loading 状态**
```gherkin
Given Git 弹窗已打开且在 Tags Tab
When 用户点击某个 Tag 的展开按钮且数据尚未加载
Then 展开区域先显示加载动画（shimmer skeleton）
and 数据加载完成后替换为实际内容
```

### UI/Interaction Checkpoints
- Tag 条目右侧增加 chevron 展开图标
- 展开动画使用 Tailwind transition
- 文件变动列表使用颜色区分：added=绿色、modified=蓝色、removed=红色
- 行数统计使用 +/- 绿红色标注

### General Checklist
- [ ] 不影响现有 Tags Tab 的基本展示功能
- [ ] 动态加载不阻塞 UI 主线程
- [ ] 大量文件变动时需限制展示数量或提供折叠
