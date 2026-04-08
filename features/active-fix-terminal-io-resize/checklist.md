# Checklist: fix-terminal-io-resize

## Completion Checklist

### Development
- [ ] All tasks in task.md completed
- [ ] Code has been self-tested

### Code Quality
- [ ] Code style follows conventions
- [ ] PTY reader 改动不影响其他功能
- [ ] 拖拽逻辑性能可接受（无频繁 re-render）

### Testing
- [ ] Bash 终端输入输出正常
- [ ] Claude Code 终端交互式内容正常
- [ ] 拖拽调整高度平滑无 bug
- [ ] 终端宽度 100%

### Documentation
- [ ] spec.md technical solution filled in
