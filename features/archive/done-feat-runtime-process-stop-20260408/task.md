# Tasks: feat-runtime-process-stop

## Task Breakdown

### 1. Rust Backend — `kill_process_by_pid` Command
- [x] 在 `lib.rs` 新增 `kill_process_by_pid(pid: u32)` Tauri Command
- [x] 使用 `sysinfo` Process.kill() 发送 SIGTERM（跨平台兼容）
- [x] 注册到 `invoke_handler`

### 2. Frontend — StatusBar Stop 按钮
- [x] 在进程详情行添加 Stop 按钮（Square 图标 + 红色调）
- [x] 点击调用 `invoke('kill_process_by_pid', { pid })`
- [x] 成功后调用 `scanRuntimes(workspacePath)` 刷新列表
- [x] 失败时显示错误提示（内联文字）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 等待开发 |
| 2026-04-08 | Backend implemented | kill_process_by_pid command using sysinfo Process.kill(), cross-platform |
| 2026-04-08 | Frontend implemented | Stop button with Square icon, red styling, error display, auto-rescan |
