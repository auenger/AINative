# Checklist: feat-native-terminal

## Completion Checklist

### Development
- [ ] 所有 task.md 中的任务项完成
- [ ] 子任务 A (Pty 单实例) 完成
- [ ] 子任务 B (xterm.js 渲染) 完成
- [ ] 子任务 C (多终端 Tab) 完成

### Code Quality
- [ ] Pty 进程有正确的清理机制 (防止僵尸进程)
- [ ] stdout 高频数据流有节流机制
- [ ] 内存管理: 关闭 Tab 正确释放 Pty 和 xterm 资源
- [ ] 跨平台兼容 (macOS zsh / Windows powershell)

### Testing
- [ ] ls -la 输出正确且带颜色
- [ ] git status 输出正确
- [ ] 多 Tab 创建切换正常
- [ ] 窗口 resize 后折行正确
- [ ] 关闭 Tab 后 Pty 进程确实被终止
- [ ] 长时间运行无内存泄漏

### Documentation
- [ ] spec.md Technical Solution 已填写
- [ ] task.md Progress Log 已更新
