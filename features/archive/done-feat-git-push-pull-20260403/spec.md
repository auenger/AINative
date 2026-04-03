# Feature: feat-git-push-pull Git 远程同步

## Basic Information
- **ID**: feat-git-push-pull
- **Name**: Git 远程同步（Push & Pull）
- **Priority**: 68
- **Size**: S
- **Dependencies**: [feat-git-stage-commit]
- **Parent**: feat-git-integration
- **Children**: []
- **Created**: 2026-04-03

## Description
在 Git 弹窗中实现 Push 和 Pull 操作：
- Push：将本地提交推送到 remote
- Pull：从 remote 拉取更新并合并
- 操作有 loading 和成功/失败反馈

## User Value Points
1. 开发者在 IDE 内完成 push/pull，保持与远程仓库同步

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs` — 需新增 git_push / git_pull Command
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:465-482` — 已有 Push/Pull 按钮 UI
- git2-rs `Remote::push()` / `Remote::fetch()` + `Repository::merge()`

### Technical Solution
1. **Rust 新建 Commands**:
   - `git_push()` — push 当前分支到 origin
   - `git_pull()` — fetch + merge 当前分支的 upstream
   - 两个命令都需要处理认证（SSH key / HTTPS credential）

2. **前端 UI 更新**:
   - 替换现有 handleSync mock 为真实 invoke 调用
   - Push/Pull 按钮 loading 状态
   - 成功/失败 toast 提示

3. **认证方案**:
   - git2-rs 支持通过 RemoteCallbacks 设置认证回调
   - 优先使用 SSH agent，回退到 HTTPS credential helper
   - 如果认证失败，返回特定错误码，前端提示用户配置

## Acceptance Criteria (Gherkin)
### Scenarios

```gherkin
Scenario: Push 成功
  Given 用户有本地未推送的提交
  When 用户点击 Push Changes 按钮
  Then 显示 loading 状态
  And push 成功后显示成功提示
  And 状态刷新

Scenario: Pull 成功
  Given 远程有新的提交
  When 用户点击 Update Remote (Pull) 按钮
  Then 显示 loading 状态
  And pull 成功后显示成功提示和更新文件数
  And 状态刷新

Scenario: Push 无新内容
  Given 本地没有未推送的提交
  When 用户点击 Push
  Then 显示 "Everything up-to-date" 提示

Scenario: 网络或认证失败
  Given 远程仓库不可达或认证失败
  When 用户点击 Push 或 Pull
  Then 显示错误提示（含错误信息）
```

### UI/Interaction Checkpoints
- Push/Pull 按钮 loading 动画
- 操作结果有短暂成功/失败反馈
- 无 remote 时按钮 disabled 并提示

### General Checklist
- [x] git2-rs Remote API 正确使用
- [x] 认证回调已设置
- [x] 错误信息用户友好

## Merge Record
- **Completed**: 2026-04-03
- **Merged Branch**: feature/feat-git-push-pull
- **Merge Commit**: e67734aba496d062f5471d3a90d2091ba43f40ca
- **Archive Tag**: feat-git-push-pull-20260403
- **Conflicts**: None
- **Verification**: PASSED (4/4 Gherkin scenarios validated)
- **Duration**: ~30 minutes
- **Files Changed**: 2 (lib.rs, ProjectView.tsx)
