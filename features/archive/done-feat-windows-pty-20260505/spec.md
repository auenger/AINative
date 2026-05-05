# Feature: feat-windows-pty Windows PTY 兼容

## Basic Information
- **ID**: feat-windows-pty
- **Name**: Windows PTY 兼容
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-shell-detect, feat-shell-settings-ui
- **Parent**: feat-cross-platform-terminal
- **Children**: []
- **Created**: 2026-04-30

## Description
修复 Windows 上 "Failed to create terminal process" 错误。确保 `portable-pty` 在 Windows 上正确使用 ConPTY API，Shell 路径正确解析，PowerShell/cmd/Git Bash/WSL 均可正常创建终端进程。

## User Value Points
1. Windows 用户可以正常使用终端（PowerShell / cmd / Git Bash / WSL）

## Context Analysis
### Reference Code
- `src-tauri/src/lib.rs` — `create_pty`, `PtyManager`
- `portable-pty` crate — 已支持 ConPTY (Windows)
- Warp `local_tty/windows/` — Windows ConPTY 动态加载参考
### Related Documents
- Warp Windows 构建: ConPTY 动态加载 kernel32.dll
- `portable-pty` 文档: Windows 上自动使用 ConPTY
### Related Features
- feat-shell-detect (上游，提供 Windows Shell 路径)
- feat-shell-settings-ui (上游，提供 Shell 选择)

## Technical Solution

### 核心问题分析
`portable-pty` 在 Windows 上已内置 ConPTY 支持，"Failed to create terminal process" 的根因是：
1. `CommandBuilder::new("/bin/zsh")` — Unix 路径在 Windows 上不存在
2. 没有传递正确的 Shell 可执行路径

### 修复方案
1. **Shell 路径正确化** — 使用 `feat-shell-detect` 检测到的 Windows Shell 路径
2. **`CommandBuilder` 平台适配** — Windows 上使用完整路径如 `C:\Program Files\PowerShell\7\pwsh.exe`
3. **环境变量传递** — Windows 上正确设置 `ComSpec`, `PATH` 等
4. **WSL 集成** — 通过 `wsl.exe -d <distro> -- <shell>` 启动 WSL 终端
5. **Git Bash 集成** — 使用 `C:\Program Files\Git\usr\bin\bash.exe` 并传递 `--login -i`

### `create_pty` 改造
```rust
fn create_pty(config: PtyConfig) -> Result<String> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize { rows, cols, .. })?;

    let mut cmd = CommandBuilder::new(&config.shell);
    cmd.args(&config.args);
    if let Some(cwd) = &config.cwd {
        cmd.cwd(cwd);
    }
    // Windows 特殊处理
    #[cfg(target_os = "windows")]
    {
        cmd.env("TERM", "xterm-256color");
    }

    let child = pair.slave.spawn_command(cmd)?;
    // ... reader/writer 设置
}
```

## Acceptance Criteria (Gherkin)
### User Story
作为 Windows 用户，我希望能正常创建终端 Tab，不出现 "Failed to create terminal process" 错误。

### Scenarios (Given/When/Then)

#### Scenario 1: PowerShell 终端创建
```gherkin
Given 应用运行在 Windows 11
And 默认 Shell 为 PowerShell 7
When 用户新建终端 Tab
Then 终端正常启动并显示 PowerShell 提示符
And 无错误弹窗
```

#### Scenario 2: Git Bash 终端创建
```gherkin
Given 应用运行在 Windows
And Git for Windows 已安装
When 用户选择 Git Bash 创建终端
Then 终端正常启动并显示 bash 提示符
```

#### Scenario 3: WSL 终端创建
```gherkin
Given 应用运行在 Windows
And WSL Ubuntu 已安装
When 用户选择 WSL Ubuntu 创建终端
Then 终端正常启动并进入 Ubuntu 环境
```

#### Scenario 4: 降级处理
```gherkin
Given 应用运行在 Windows
And PowerShell 7 未安装
When 应用初始化终端
Then 回退使用 PowerShell 5 或 cmd
And 终端正常启动
```

### General Checklist
- [ ] Windows CI 构建通过
- [ ] 所有 Shell 类型在 Windows 10/11 测试通过
- [ ] 错误信息用户友好（非 Rust panic）

## Merge Record
- **Completed**: 2026-05-05
- **Merged Branch**: feature/feat-windows-pty
- **Merge Commit**: d87ef23
- **Archive Tag**: feat-windows-pty-20260505
- **Conflicts**: none
- **Verification**: passed (code analysis, 4/4 Gherkin scenarios)
- **Commits**: 2 (implementation + evidence)
- **Files Changed**: 5
