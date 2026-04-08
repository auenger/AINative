# Checklist: feat-claude-code-runtime-monitor

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] Rust 进程检测在 macOS/Linux 验证通过
- [ ] dev mode fallback 正常工作

### Code Quality
- [ ] Code style follows conventions (cn() for styles, types.ts for types)
- [ ] Rust code follows existing pattern (tauri::command, Serialize/Deserialize)
- [ ] No hardcoded values (轮询间隔可配置)

### Testing
- [ ] Unit tests for process matching logic (Rust)
- [ ] Hook tests (useRuntimeMonitor with mock)
- [ ] StatusBar rendering tests (running vs idle states)

### Documentation
- [ ] spec.md technical solution filled
- [ ] IPC Contract updated in project-context.md
