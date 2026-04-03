# Feature: feat-git-stage-commit Git 暂存与提交

## Basic Information
- **ID**: feat-git-stage-commit
- **Name**: Git 暂存与提交
- **Priority**: 70
- **Size**: S
- **Dependencies**: [feat-git-status-read]
- **Parent**: feat-git-integration
- **Children**: []
- **Created**: 2026-04-03

## Description
在 Git 弹窗中实现 Stage 和 Commit 操作：
- 点击文件旁边的 stage/unstage 按钮
- 输入 commit message 并提交
- 提交后自动刷新状态

## User Value Points
1. 开发者可在 IDE 内完成 stage → commit 流程，无需打开终端

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — 需新增 git_stage / git_commit Command
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 弹窗底部按钮区
- git2-rs `Repository::index()` / `Index::add_path()` / `Repository::commit()`

### Technical Solution
1. **Rust 新建 Commands**:
   - `git_stage_file(path: String)` — git add 单个文件
   - `git_stage_all()` — git add -A
   - `git_unstage_file(path: String)` — git reset HEAD 单个文件
   - `git_commit(message: String)` — git commit

2. **前端 UI 更新**:
   - 变更文件列表每项添加 stage/unstage 按钮
   - 底部添加 commit 输入框和 commit 按钮
   - 操作后调用 useGitStatus.refresh() 刷新

## Acceptance Criteria (Gherkin)
### Scenarios

```gherkin
Scenario: 暂存单个文件
  Given Git 弹窗显示 "unstaged" 文件 "src/app.tsx"
  When 用户点击该文件旁的 stage 按钮
  Then 文件移动到 "staged" 列表
  And 列表自动刷新

Scenario: 提交暂存的文件
  Given 用户已暂存至少一个文件
  When 用户输入 commit message "fix: login bug" 并点击 Commit
  Then 提交成功，staged 列表清空
  And 显示成功提示

Scenario: 未输入 message 时禁用 commit
  Given 用户已暂存文件但未输入 commit message
  Then Commit 按钮为 disabled 状态
```

### UI/Interaction Checkpoints
- staged / unstaged 文件分组显示
- stage/unstage 按钮有 loading 反馈
- commit 输入框 + commit 按钮在底部区域

### General Checklist
- [x] git2-rs index/commit API 正确使用
- [x] commit 后状态自动刷新
- [x] 错误场景有 UI 提示

## Merge Record
- **Completed**: 2026-04-03T20:50:00Z
- **Merged Branch**: feature/feat-git-stage-commit
- **Merge Commit**: bbd1d98
- **Archive Tag**: feat-git-stage-commit-20260403
- **Conflicts**: None
- **Verification**: passed (3/3 Gherkin scenarios, cargo check clean)
- **Development Stats**: 1 commit, 3 files changed, 358 insertions, 48 deletions
