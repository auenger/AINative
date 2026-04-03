# Tasks: feat-git-stage-commit
## Task Breakdown

### 1. Rust 后端 — Stage & Commit Commands
- [x] 实现 `git_stage_file(path)` Command
- [x] 实现 `git_unstage_file(path)` Command
- [x] 实现 `git_commit(message)` Command
- [x] 注册所有新 Commands

### 2. 前端 UI — Stage/Unstage 操作
- [x] 变更文件列表分 staged / unstaged 两组
- [x] 每个文件添加 stage/unstage 按钮
- [x] 操作后刷新 Git 状态

### 3. 前端 UI — Commit 功能
- [x] 弹窗底部添加 commit message 输入框
- [x] 添加 Commit 按钮（有 staged 文件 + 非空 message 时启用）
- [x] commit 成功后清空输入并刷新状态

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | |
| 2026-04-03 | All tasks implemented | Rust: git_stage_file, git_stage_all, git_unstage_file, git_commit. Frontend: grouped files, stage/unstage buttons, commit input |
