# Tasks: feat-native-terminal

## Task Breakdown

### 1. Rust Pty 单实例 (子任务 A)
- [x] Cargo.toml 添加 portable-pty, tokio, uuid 依赖
- [x] 实现 Pty 派生 (macOS: zsh, Windows: powershell)
- [x] 实现 stdout 读取 -> emit("pty-out") 广播
- [x] 实现 `write_to_pty` command (stdin 写入)
- [x] 实现 `create_pty` command (返回 pty_id)
- [x] 实现 `resize_pty` command (PtySize 更新)

### 2. xterm.js 前端渲染 (子任务 B)
- [x] 安装 xterm, @xterm/xterm, @xterm/addon-fit
- [x] EditorView 底部终端区域替换为 xterm.js 宄器
- [x] xterm.onData() -> invoke('write_to_pty') 键盘输入
- [x] listen('pty-out') -> xterm.write() 输出渲染
- [x] 终端主题配置 (匹配深色设计系统)
- [x] ANSI 颜色码正确渲染

### 3. 多终端 Tab 管理 (子任务 C)
- [x] Rust: TerminalManager (HashMap 管理 Pty 实例)
- [x] 前端: 多 Tab UI (Bash / Claude / Gemini)
- [x] Tab 切换: 前端保存/恢复 xterm buffer
- [x] 新建终端: create_pty + 新建 xterm 实例
- [x] 关闭终端: 销毁 Pty 进程 + 清理资源
- [x] resize 事件: 窗口大小变化 -> 所有 Pty 同步 resize
- [x] Claude CLI / Gemini CLI 带参启动

### 4. 验证
- [ ] 基本命令执行 (ls, pwd, echo, git status)
- [ ] 颜色渲染 (ls --color, git log)
- [ ] 交互式命令 (vim 部分支持, top)
- [ ] 多终端创建/切换/关闭
- [ ] resize 正确同步
- [ ] 长时间运行稳定性 (内存泄漏检测)

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，建议按 A->B->C 顺序开发 |
| 2026-04-01 | Sub-task A done | Rust Pty 单实例跑通 (create/write/resize/kill commands) |
| 2026-04-01 | Sub-task B done | xterm.js 前端渲染 + 数据对接完成 |
| 2026-04-01 | Sub-task C done | 多终端 Tab 管理 + resize + Claude/Gemini CLI 集成完成 |
