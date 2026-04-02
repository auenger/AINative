# Tasks: feat-git-status-read
## Task Breakdown

### 1. Rust 后端 — fetch_git_status Command
- [x] 在 lib.rs 新增 `GitStatusResult` / `FileDiffInfo` 结构体
- [x] 实现 `fetch_git_status` Command：获取当前分支、remote URL、变更文件列表及 diff 统计
- [x] 注册 Command 到 Tauri builder

### 2. 前端类型 — types.ts
- [x] 新增 `GitStatusResult` / `FileDiffInfo` 类型定义

### 3. 前端 Hook — useGitStatus
- [x] 创建 `neuro-syntax-ide/src/lib/useGitStatus.ts`
- [x] workspacePath 存在时调用 invoke('fetch_git_status')
- [x] 返回 { data, loading, error, refresh }

### 4. 前端 UI — ProjectView.tsx Git 弹窗
- [x] 接入 useGitStatus hook
- [x] 替换所有 mock 数据为真实数据
- [x] 变更文件列表动态渲染
- [x] 添加 loading / error / empty 状态

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | |
| 2026-04-03 | All tasks implemented | Rust command, types, hook, UI all done |
