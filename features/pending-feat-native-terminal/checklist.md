# Checklist: feat-native-terminal

## Completion Checklist

### Development
- [x] 所有 task.md 中的任务项完成
- [x] 子任务 A (Pty 单实例) 完成
- [x] 子任务 B (xterm.js 渲染) 完成
- [x] 子任务 C (多终端 Tab) 完成

### Code Quality
- [x] Pty 进程有正确的清理机制 (防止僵尸进程) - dropping master handle kills child
- [ ] stdout 高频数据流有节流机制 - line-by-line reading with BufReader
- [x] 内存管理: 关闭 Tab 正确释放 Pty 和 xterm 资源 - unmount disposes xterm + kill pty
- [x] 跨平台兼容 (macOS zsh / Windows powershell) - CommandBuilder::new selects shell

 config

### Testing
- [ ] ls -la 输出正确且带颜色
- [ ] git status 输出正确
- [ ] 多 Tab 创建切换正常
- [ ] 窗口 resize 后折行正确
- [ ] 关闭 Tab 后 Pty 进程确实被终止
- [ ] 长时间运行无内存泄漏

 - TBD (需实际运行验证)

### Documentation
- [x] spec.md Technical Solution 已填写
- [x] task.md Progress Log 已更新
