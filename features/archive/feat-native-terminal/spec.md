# Feature: feat-native-terminal xterm.js 真实终端

## Basic Information
- **ID**: feat-native-terminal
- **Name**: xterm.js 真实终端
- **Priority**: 55
- **Size**: L
- **Dependencies**: feat-tauri-v2-init
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

在 EditorView 底部终端区域实现真实的 Shell 终端。Rust 后端通过 `portable-pty` 派生子进程，前端用 xterm.js 渲染，实现双向数据流：用户按键 → Rust stdin，Rust stdout → xterm 渲染。支持多终端 Tab (Bash / Claude CLI / Gemini CLI)。

## User Value Points

### VP1: 真实 Shell 终端
在 IDE 内直接使用系统 Shell (zsh/bash/powershell) 执行任意命令，体验与系统终端完全一致。

### VP2: 多终端标签
同时运行多个终端实例，包括系统 Shell 和 AI CLI 工具 (Claude CLI, Gemini CLI)。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 打开终端并执行命令
  Given 用户切换到 Editor 视图
  When 用户点击终端区域的 "Bash" Tab
  Then 终端显示 Shell 提示符 ($ 或 %)
  When 用户输入 "ls -la" 并回车
  Then 终端显示当前目录的文件列表
  And 颜色和格式与系统终端一致

Scenario: 多终端标签切换
  Given 已打开 Bash 终端
  When 用户点击 "+" 创建新终端并选择 "Claude CLI"
  Then 新 Tab 激活并启动 Claude CLI
  When 用户切换回 Bash Tab
  Then Bash 终端状态完全保留

Scenario: 终端窗口 resize
  Given 终端已打开
  When 用户拖拽调整 IDE 窗口大小
  Then 终端内容自动重新排版
  And 折行正确，不会出现乱码
```

## Technical Solution

### Rust 后端 (portable-pty)
```rust
// 派生 Pty 子进程
let pty = native_pty_system().openpty(PtySize { rows: 24, cols: 80, .. })?;
let child = pty.slave.spawn_command(SimpleCommand::new().arg("zsh"))?;

// 读取 stdout → emit 到前端
let reader = pty.master.try_clone_reader()?;
tokio::spawn(async move {
    // 读取并广播
    app_handle.emit("pty-out", data);
});

// 接收前端输入 → 写入 stdin
#[tauri::command]
fn write_to_pty(pty_id: &str, data: &str) { ... }
```

### 前端 (xterm.js)
- 安装 `xterm`, `xterm-addon-fit`, `xterm-addon-web-links`
- `xterm.onData()` → `invoke('write_to_pty', { data })`
- `listen('pty-out')` → `xterm.write(data)`
- Resize: `xterm-addon-fit` + `invoke('resize_pty', { cols, rows })`

### 多终端管理
- 每个终端 Tab 对应一个独立的 Pty 实例
- TerminalManager (Rust): HashMap<PtyId, PtyProcess>
- 前端: 每个终端 Tab 持有独立的 Terminal 实例

### 建议拆分策略 (Size L)
- **子任务 A**: Rust Pty 单实例跑通 (stdin/stdout 双向流)
- **子任务 B**: xterm.js 前端渲染 + 数据对接
- **子任务 C**: 多终端 Tab + resize + Claude/Gemini CLI 集成
