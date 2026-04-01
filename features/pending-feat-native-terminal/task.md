# Tasks: feat-native-terminal

## Task Breakdown

### 1. Rust Pty 单实例 (子任务 A)
- [ ] Cargo.toml 添加 portable-pty, tokio 依赖
- [ ] 实现 Pty 派生 (macOS: zsh, Windows: powershell)
- [ ] 实现 stdout 读取 → emit("pty-out") 广播
- [ ] 实现 `write_to_pty` command (stdin 写入)
- [ ] 实现 `create_pty` command (返回 pty_id)
- [ ] 实现 `resize_pty` command (PtySize 更新)

### 2. xterm.js 前端渲染 (子任务 B)
- [ ] 安装 xterm, @xterm/xterm, @xterm/addon-fit
- [ ] EditorView 底部终端区域替换为 xterm.js 容器
- [ ] xterm.onData() → invoke('write_to_pty') 键盘输入
- [ ] listen('pty-out') → xterm.write() 输出渲染
- [ ] 终端主题配置 (匹配深色设计系统)
- [ ] ANSI 颜色码正确渲染

### 3. 多终端 Tab 管理 (子任务 C)
- [ ] Rust: TerminalManager (HashMap 管理 Pty 实例)
- [ ] 前端: 多 Tab UI (Bash / Claude / Gemini)
- [ ] Tab 切换: 前端保存/恢复 xterm buffer
- [ ] 新建终端: create_pty + 新建 xterm 实例
- [ ] 关闭终端: 销毁 Pty 进程 + 清理资源
- [ ] resize 事件: 窗口大小变化 → 所有 Pty 同步 resize
- [ ] Claude CLI / Gemini CLI 带参启动

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
| 2026-04-01 | Created | Feature 规划完成，建议按 A→B→C 顺序开发 |
