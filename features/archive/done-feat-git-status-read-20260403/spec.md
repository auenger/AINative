# Feature: feat-git-status-read Git 状态真实展示

## Basic Information
- **ID**: feat-git-status-read
- **Name**: Git 状态真实展示
- **Priority**: 72
- **Size**: S
- **Dependencies**: []
- **Parent**: feat-git-integration
- **Children**: []
- **Created**: 2026-04-03

## Description
替换 ProjectView.tsx Git 弹窗中的所有 mock 数据为真实数据：
- 当前分支名（从 git2-rs 获取）
- Remote URL（从 git2-rs 获取）
- 工作区变更文件列表（staged / unstaged / untracked）
- 每个变更文件的 diff 统计（+行 / -行）

## User Value Points
1. 开发者打开 Git 弹窗即可看到真实的仓库状态，无需切换终端

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:904-995` — 已有 fetch_git_stats，需扩展或新建 Command
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:381-486` — Git 弹窗 mock 数据
- `neuro-syntax-ide/src/types.ts:61-80` — 已有 GitStats 类型，需扩展 FileDiffInfo

### Technical Solution
1. **Rust 新建 Command**: `fetch_git_status`
   - 输入: workspace_path (从 AppState 获取)
   - 输出: `{ current_branch, remote_url, staged: FileDiff[], unstaged: FileDiff[], untracked: string[] }`
   - 使用 git2-rs Repository::discover + status + diff

2. **前端新建 Hook**: `useGitStatus`
   - workspacePath 存在时自动调用 invoke('fetch_git_status')
   - 返回 { data, loading, error, refresh }
   - 弹窗打开时 refresh

3. **前端类型扩展**: types.ts 新增 `GitStatusResult`, `FileDiffInfo`
   ```typescript
   interface FileDiffInfo {
     path: string;
     status: 'staged' | 'unstaged' | 'untracked';
     additions: number;
     deletions: number;
   }
   interface GitStatusResult {
     current_branch: string;
     remote_url: string | null;
     files: FileDiffInfo[];
   }
   ```

4. **更新 ProjectView.tsx**: 弹窗内容从 useGitStatus 读取

## Acceptance Criteria (Gherkin)
### Scenarios

```gherkin
Scenario: 打开 Git 弹窗显示真实仓库状态
  Given 用户已打开一个 Git 仓库工作区
  When 用户点击项目管理页面的 Git 按钮
  Then 弹窗显示当前真实分支名
  And 显示真实 remote URL
  And 显示所有变更文件及 +/- 统计
  And 不再显示硬编码的 mock 数据

Scenario: 工作区无变更时显示空状态
  Given 用户工作区没有任何文件变更
  When 用户打开 Git 弹窗
  Then 变更文件列表显示 "No changes detected" 或类似提示

Scenario: 非 Git 仓库时优雅降级
  Given 用户打开的目录不是 Git 仓库
  When 用户点击 Git 按钮
  Then 弹窗显示 "Not a git repository" 提示
  And 不崩溃、不报错
```

### UI/Interaction Checkpoints
- 分支名从真实数据渲染
- 变更文件列表动态渲染，每项显示文件名 + 状态 + diff 统计
- Remote URL 为空时显示 "No remote configured"

### General Checklist
- [x] mock 数据完全移除
- [x] loading 状态有 UI 反馈（spinner）
- [x] 错误状态有 UI 提示

## Merge Record
- **Completed**: 2026-04-03T19:30:00Z
- **Merged Branch**: feature/feat-git-status-read
- **Merge Commit**: aa74395
- **Archive Tag**: feat-git-status-read-20260403
- **Conflicts**: None
- **Verification**: All 3 Gherkin scenarios passed
- **Files Changed**: 4 (lib.rs, types.ts, useGitStatus.ts, ProjectView.tsx)
- **Duration**: ~1.5 hours
