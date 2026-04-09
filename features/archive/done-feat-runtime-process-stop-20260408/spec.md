# Feature: feat-runtime-process-stop Agent Runtime 进程 Stop 按钮（PID Kill）

## Basic Information
- **ID**: feat-runtime-process-stop
- **Name**: Agent Runtime 进程 Stop 按钮（PID Kill）
- **Priority**: 75
- **Size**: S
- **Dependencies**: feat-claude-code-runtime-monitor (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-08T21:30:00Z

## Description

在 StatusBar 的 AGENT RUNTIMES 下拉面板中，为每个运行中的进程添加 Stop 按钮。
点击 Stop 后，通过 PID 真正杀掉对应进程（Rust 后端 `kill` syscall），并刷新进程列表。

核心能力：
1. 后端新增 `kill_process_by_pid` Tauri Command，接受 PID 参数，执行 `kill(pid, SIGTERM)`
2. 前端 StatusBar 每个进程行添加 Stop 按钮（Square/Stop 图标）
3. 点击 Stop → 确认 → 调用后端 → 成功后自动 rescan 刷新列表
4. 支持 app 启动的进程和外部检测到的进程

## User Value Points

### VP1: 逐进程 Stop 按钮 + PID Kill
用户可以在 Runtime 面板中直接点击 Stop 按钮终止任意 Agent 进程，
无需切换到终端手动 kill。Stop 操作通过 PID 精确匹配目标进程。

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/StatusBar.tsx` — 进程列表渲染（L241-248）
- `neuro-syntax-ide/src-tauri/src/lib.rs` — `runtime_session_stop` (L5103) 已有杀进程逻辑
- `neuro-syntax-ide/src/lib/useRuntimeMonitor.ts` — 进程监控 hook

### Related Features
- `feat-claude-code-runtime-monitor` (completed) — Runtime 状态监听基础
- `feat-runtime-session-output` (completed) — Session 输出持久化
- `feat-runtime-output-polish` (completed) — Output Modal

## Technical Solution

### 1. Rust 后端 — 新增 `kill_process_by_pid` Command
```rust
#[tauri::command]
fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    // Use nix::sys::signal::kill(Pid::from_raw(pid as i32), Signal::SIGTERM)
    // Fallback: std::process::Command::new("kill").arg(pid.to_string())
}
```
注册到 `invoke_handler`。

### 2. 前端 — StatusBar 进程行添加 Stop 按钮
在进程详情 grid 旁添加 Stop 图标按钮：
- 使用 lucide-react `Square` 或 `X` 图标
- 点击触发 `invoke('kill_process_by_pid', { pid })`
- 成功后调用 `scanRuntimes(workspacePath)` 刷新

### 3. 确认与反馈
- Stop 按钮点击后直接执行（进程管理是即时操作）
- 失败时 toast/内联提示错误信息

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我希望在 Runtime 面板中直接 Stop 任意运行中的 Agent 进程，
这样我无需手动打开终端去 kill。

### Scenarios

#### Scenario 1: Stop 外部检测到的进程
```gherkin
Given StatusBar 显示 2 个运行中的 Claude Code 进程
And 进程 PID 26572 和 PID 25067 已被检测到
When 用户点击 PID 26572 旁的 Stop 按钮
Then 后端收到 kill_process_by_pid(26572) 调用
And 进程 26572 被终止
And 进程列表自动刷新，只剩 1 个进程
```

#### Scenario 2: Stop app 启动的进程
```gherkin
Given 用户通过 Runtime Execute 启动了一个 Claude Code 进程 (PID 12345)
And 该进程有活跃的 session output
When 用户点击 Stop 按钮
Then 进程被终止
And session 状态被清理
And View Output 按钮消失
```

#### Scenario 3: Kill 失败（进程已退出）
```gherkin
Given 进程 PID 99999 已不存在
When 用户尝试 Stop 该进程
Then 返回错误提示 "Process not found or already terminated"
And UI 显示错误状态但不崩溃
```

### UI/Interaction Checkpoints
- [ ] Stop 按钮在进程详情网格右侧，红色/警告色调
- [ ] 鼠标 hover Stop 按钮有视觉反馈
- [ ] 成功 Stop 后进程行平滑消失

### General Checklist
- [ ] 不影响 Rescan、View Output 等现有功能
- [ ] 跨平台兼容（macOS SIGTERM / Windows TerminateProcess）

## Merge Record

- **Completed**: 2026-04-08T22:36:00Z
- **Merged Branch**: feature/feat-runtime-process-stop
- **Merge Commit**: 4349f65
- **Feature Commit**: 974442e
- **Archive Tag**: feat-runtime-process-stop-20260408
- **Conflicts**: None during rebase; stash pop conflict in StatusBar.tsx resolved (kept stop error display + stashed conditional rendering)
- **Verification**: PASSED (2/2 tasks, 3/3 Gherkin scenarios)
- **Evidence**: evidence/verification-report.md
- **Stats**: 1 commit, 2 files changed, +116 lines
