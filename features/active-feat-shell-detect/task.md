# Tasks: feat-shell-detect
## Task Breakdown
### 1. Rust Shell 类型定义
- [x] 定义 `ShellType` 枚举 (Zsh/Bash/Fish/PowerShell/Cmd/GitBash/Wsl)
- [x] 定义 `DetectedShell` 结构体
### 2. macOS/Linux Shell 检测
- [x] 读取 `$SHELL` 环境变量
- [x] 解析 `/etc/shells` 文件
- [x] 搜索 Homebrew 路径 (`/opt/homebrew/bin`, `/usr/local/bin`)
- [x] 验证可执行文件存在且可执行
### 3. Windows Shell 检测
- [x] 搜索 PowerShell 7 (Program Files / WindowsApps / scoop / dotnet)
- [x] 搜索 PowerShell 5 (System32)
- [x] 搜索 cmd.exe
- [x] 搜索 Git Bash 安装路径
- [x] 搜索 WSL 发行版列表
### 4. detect_shells Command
- [x] 实现 `detect_shells` Tauri Command
- [x] 添加结果缓存（单次检测，生命周期内复用）
- [x] 注册 Command 到 invoke_handler
### 5. 前端集成
- [x] 修改 `XTerminal.tsx` 移除硬编码 `/bin/zsh`
- [x] `shellForKind()` 改为从 detect_shells 获取默认 Shell
- [x] bash 类型终端使用检测到的默认 Shell
## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Feature created | 子 Feature 1/3 |
| 2026-05-05 | Implementation complete | All 5 tasks done, Rust compiles, Vite build OK |
