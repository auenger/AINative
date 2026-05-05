# Feature: feat-shell-detect Shell 自动发现与检测

## Basic Information
- **ID**: feat-shell-detect
- **Name**: Shell 自动发现与检测
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-native-terminal
- **Parent**: feat-cross-platform-terminal
- **Children**: []
- **Created**: 2026-04-30

## Description
在 Rust 后端实现跨平台 Shell 自动发现。应用启动时扫描可用 Shell，返回结构化列表给前端。借鉴 Warp 的 `AvailableShells` 模式，按平台搜索常见安装路径。

## User Value Points
1. 应用启动时自动检测当前 OS 可用的 Shell 列表（zsh/bash/fish/pwsh/cmd/git-bash/wsl）

## Context Analysis
### Reference Code
- `src-tauri/src/lib.rs` — `PtyConfig` 结构体、`create_pty` Command
- `XTerminal.tsx:41` — 硬编码 `/bin/zsh`，需改为从后端获取
- Warp `available_shells.rs` — Shell 发现逻辑参考
### Related Documents
- Warp 的 `ShellType` 枚举和 `from_name()` 解析
### Related Features
- feat-native-terminal (终端基线)
- feat-shell-settings-ui (下游，依赖本 Feature)

## Technical Solution

### Rust 侧新增

```rust
// 1. ShellType 枚举
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ShellType {
    Zsh, Bash, Fish, PowerShell, Cmd, GitBash, Wsl(String),
}

// 2. DetectedShell 结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedShell {
    shell_type: ShellType,
    name: String,        // 显示名: "PowerShell 7"
    path: String,        // 可执行路径
    is_default: bool,    // 是否为用户默认 Shell
}

// 3. detect_shells Command
#[tauri::command]
fn detect_shells() -> Vec<DetectedShell>
```

### 平台检测策略

**macOS / Linux:**
1. 读取 `$SHELL` 环境变量 → 标记为 default
2. 读取 `/etc/shells` 获取管理员批准的 Shell 列表
3. 额外搜索: `/opt/homebrew/bin`, `/usr/local/bin`
4. 按 zsh > bash > fish 优先级排序

**Windows:**
1. 搜索 PowerShell 7: `Program Files`, `WindowsApps`, `scoop`, `dotnet`
2. 搜索 PowerShell 5: `System32\WindowsPowerShell\v1.0`
3. 搜索 cmd: `System32\cmd.exe`
4. 搜索 Git Bash: `Program Files\Git\usr\bin`, `scoop\apps\git`
5. 搜索 WSL: 通过 `wsl --list` 获取发行版列表
6. 默认选 PowerShell 7，回退到 cmd

### 前端集成
- `XTerminal.tsx` 中 `shellForKind()` 改为调用 `detect_shells` 获取默认 Shell
- 移除硬编码 `/bin/zsh`

## Acceptance Criteria (Gherkin)
### User Story
作为应用开发者，我希望后端能自动发现当前平台可用的 Shell，以便终端组件不再硬编码路径。

### Scenarios (Given/When/Then)

#### Scenario 1: macOS Shell 检测
```gherkin
Given 应用运行在 macOS
When 调用 detect_shells
Then 返回至少包含 zsh 和 bash 的列表
And $SHELL 对应的 Shell 标记为 default
```

#### Scenario 2: Windows Shell 检测
```gherkin
Given 应用运行在 Windows
When 调用 detect_shells
Then 返回至少包含 PowerShell 和 cmd 的列表
And PowerShell 7 (如果存在) 标记为 default
```

#### Scenario 3: 检测结果缓存
```gherkin
Given detect_shells 已被调用一次
When 再次调用 detect_shells
Then 返回缓存结果，不重复扫描文件系统
```

### General Checklist
- [ ] 不阻塞应用启动（Shell 检测异步或延迟执行）
- [ ] Shell 不存在时优雅降级，不 panic
