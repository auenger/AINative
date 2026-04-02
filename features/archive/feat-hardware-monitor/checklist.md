# Checklist: feat-hardware-monitor

## Completion Checklist

### Development
- [ ] 所有 task.md 中的任务项完成
- [ ] 硬件监控线程正确启停
- [ ] Git 统计功能完成

### Code Quality
- [ ] 监控线程不影响主线程性能
- [ ] 广播数据量精简 (不传冗余数据)
- [ ] 跨平台兼容 (macOS/Windows 数据格式)

### Testing
- [ ] CPU 数据与系统工具一致
- [ ] 内存数据与系统工具一致
- [ ] 折线图实时更新流畅
- [ ] Git 统计准确
- [ ] 长时间运行稳定 (内存/线程泄漏检测)

### Documentation
- [ ] spec.md Technical Solution 已填写
- [ ] task.md Progress Log 已更新
