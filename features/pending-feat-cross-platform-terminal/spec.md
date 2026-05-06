# Feature: feat-cross-platform-terminal 跨平台终端 Shell 配置

## Basic Information
- **ID**: feat-cross-platform-terminal
- **Name**: 跨平台终端 Shell 配置
- **Priority**: 70
- **Size**: L
- **Dependencies**: feat-native-terminal
- **Parent**: null
- **Children**: [feat-shell-detect, feat-shell-settings-ui, feat-windows-pty]
- **Created**: 2026-04-30

## Description
解决终端在 Windows 上 "Failed to create terminal process" 的问题，建立跨平台 Shell 自动发现、用户可配置切换的完整方案。借鉴 Warp 终端的分层 Shell 解析架构。

## User Value Points
1. **Shell 自动发现** — 应用启动时自动检测当前 OS 可用的 Shell 列表
2. **Shell 切换 UI** — Settings 页面提供 Shell 下拉选择，终端 Tab 使用选定 Shell
3. **Windows PTY 兼容** — Windows 上正确使用 ConPTY，支持 PowerShell / cmd / Git Bash / WSL

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/XTerminal.tsx` — 前端终端组件，硬编码 `/bin/zsh`
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Rust PTY 管理，`PtyConfig` 结构体
- `portable-pty` crate — 已集成，支持 ConPTY (Windows)
### Related Documents
- Warp 开源架构: `available_shells.rs`, `ShellStarter`, `local_tty/` 模块
### Related Features
- feat-native-terminal (Phase 3 终端基线)

## Technical Solution
借鉴 Warp 分层解析链：
```
用户设置 (Settings) → 环境变量 ($SHELL) → OS 默认 → 硬编码兜底
```

### 架构决策
- Shell 检测放 Rust 侧（`detect_shells` Command），前端通过 IPC 获取列表
- Shell 偏好存入 Settings YAML（FS-as-Database）
- `ShellType` 枚举: Zsh / Bash / Fish / PowerShell / Cmd / Wsl
- Windows ConPTY 由 `portable-pty` 自动处理，但 Shell 路径需正确发现

## Acceptance Criteria (Gherkin)
### User Story
作为 Windows/macOS 用户，我希望能选择终端使用的 Shell，这样我可以在不同平台上正常使用终端。

### Scenarios (Given/When/Then)

#### Scenario 1: macOS 默认 Shell 检测
```gherkin
Given 用户在 macOS 上启动应用
When 应用初始化终端
Then 系统自动检测到 zsh/bash/fish 等可用 Shell
And 默认使用用户登录 Shell ($SHELL)
```

#### Scenario 2: Windows PowerShell 检测
```gherkin
Given 用户在 Windows 上启动应用
When 应用初始化终端
Then 系统自动检测到 PowerShell 7/5、cmd、Git Bash
And 默认使用 PowerShell 7 (pwsh.exe)
```

#### Scenario 3: Settings 切换 Shell
```gherkin
Given 用户打开 Settings 页面
When 用户在 "Terminal Shell" 下拉中选择 "Git Bash"
Then 后续新建的终端 Tab 使用 Git Bash
And 设置持久化到本地
```

#### Scenario 4: Windows 终端正常创建
```gherkin
Given 用户在 Windows 上
And 已配置 Shell 为 PowerShell
When 用户新建终端 Tab
Then 终端正常启动，不报 "Failed to create terminal process"
```

### UI/Interaction Checkpoints
- Settings 页面新增 "Terminal" 区域，含 Shell 下拉选择
- 终端 Tab 右键菜单可快速切换 Shell
- 检测到的 Shell 列表显示 Shell 名称 + 路径

### General Checklist
- [ ] 不在 Windows 上硬编码 Unix 路径
- [ ] Shell 检测结果缓存，不每次创建终端都重新检测
- [ ] 用户选择无效 Shell 时给出友好错误提示
