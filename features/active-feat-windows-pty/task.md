# Tasks: feat-windows-pty
## Task Breakdown
### 1. create_pty 跨平台适配
- [x] 修改 `CommandBuilder` 使用检测到的 Shell 完整路径
- [x] 添加 `cfg(target_os = "windows")` 条件编译
- [x] Windows 上设置正确环境变量 (TERM, ComSpec)
### 2. Windows Shell 特殊处理
- [x] PowerShell: 传递 `-NoLogo` 参数
- [x] Git Bash: 传递 `--login -i` 参数
- [x] WSL: 通过 `wsl.exe -d <distro>` 包装启动
- [x] cmd: 无特殊参数
### 3. 错误处理增强
- [x] Shell 路径不存在时返回友好错误（非 panic）
- [x] PTY 创建失败时提供诊断信息（Shell 路径 + 平台信息）
- [x] 前端展示错误 toast，建议用户检查 Settings
### 4. 测试验证
- [ ] Windows 10 + PowerShell 5 测试
- [ ] Windows 11 + PowerShell 7 测试
- [ ] Windows + Git Bash 测试
- [ ] Windows + WSL 测试
## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Feature created | 子 Feature 3/3 |
| 2026-05-05 | Tasks 1-3 implemented | Rust: build_shell_command + error handling; Frontend: shellArgsForPath |
