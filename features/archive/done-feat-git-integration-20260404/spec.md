# Feature: feat-git-integration Git 集成功能

## Basic Information
- **ID**: feat-git-integration
- **Name**: Git 集成功能
- **Priority**: 70
- **Size**: L
- **Dependencies**: []
- **Parent**: null
- **Children**: [feat-git-status-read, feat-git-stage-commit, feat-git-push-pull]
- **Created**: 2026-04-03

## Description
项目管理页面的 Git 按钮（ProjectView.tsx:381-486）弹窗目前全部使用 mock 数据。
本 feature 将其替换为真实 Git 功能：从 Rust 后端通过 git2-rs 获取仓库状态，
支持 stage/commit/push/pull 等操作，实现完整的 Git 工作流。

## User Value Points
1. **Git 状态真实展示** — 分支、remote URL、变更文件列表、diff +/- 统计
2. **Stage & Commit** — 选择文件暂存、输入 commit message、提交变更
3. **Push & Pull 同步** — 推送到远端、从远端拉取更新

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:381-486` — Git 弹窗 (mock)
- `neuro-syntax-ide/src-tauri/src/lib.rs:904-995` — 已有 fetch_git_stats 命令
- `neuro-syntax-ide/src/types.ts:61-80` — GitStats / ContributorInfo / RecentCommit 类型
- `neuro-syntax-ide/src-tauri/Cargo.toml` — git2 = "0.20" 已引入

### Related Documents
- `project-context.md` — Phase 4: git2-rs Git 统计分析规划

### Related Features
- feat-hardware-monitor (已完成) — 类似的 Tauri Command + 前端数据刷新模式

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我想在 IDE 内管理 Git 操作，而不必切换到终端。

### Scenarios (Given/When/Then)
详见各子 feature 的 spec.md

### UI/Interaction Checkpoints
- Git 弹窗展示真实数据而非硬编码
- 变更文件列表可点击查看 diff
- Stage/Commit/Push 按钮有真实的 loading 和成功/失败反馈
- 分支名实时显示

### General Checklist
- [ ] 所有 mock 数据移除
- [ ] Rust Command 通过 git2-rs 实现
- [ ] 前端通过 invoke() 调用，不硬编码
- [ ] 错误状态有 UI 反馈
