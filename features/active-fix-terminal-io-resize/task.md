# Tasks: fix-terminal-io-resize

## Task Breakdown

### 1. 修复 PTY Reader（核心 I/O 问题）
- [ ] 修改 `lib.rs` PtyManager::create 中的 reader thread：将 `BufReader::lines()` 替换为 `read()` 分块读取
- [ ] 确保 raw bytes 正确转换为 String 并通过 `pty-out` 事件 emit
- [ ] 保留 `pty-closed` 事件在 EOF 时触发

### 2. 终端面板拖拽调整高度
- [ ] 在 EditorView 中添加 `terminalHeight` state（默认 240px，最小 100px）
- [ ] 添加拖拽手柄 div，位于终端面板顶部 border 处
- [ ] 实现 mousedown/mousemove/mouseup 拖拽逻辑（使用 requestAnimationFrame）
- [ ] 拖拽结束后调用 FitAddon.fit() 重新计算 xterm 尺寸
- [ ] 将硬编码 `animate={{ height: 240 }}` 改为动态 `style={{ height: terminalHeight }}`

### 3. 修复终端宽度 100%
- [ ] 检查并修复 XTerminal 容器 CSS，确保 xterm 占满面板宽度
- [ ] 确保 resize 后 xterm 正确 refit

### 4. 联调测试
- [ ] 验证 Bash 终端：输入命令、查看输出
- [ ] 验证 Claude Code 终端：交互式 UI 正常显示
- [ ] 验证拖拽调整高度：平滑、无闪烁
- [ ] 验证宽度 100%：无留白

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | Created | Feature created from bug report |
