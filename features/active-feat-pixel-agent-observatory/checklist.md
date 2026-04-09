# Checklist: feat-pixel-agent-observatory

## Completion Checklist

### Development
- [ ] All Phase 1 tasks completed（素材迁移 + Rust 后端）
- [ ] All Phase 2 tasks completed（前端渲染引擎移植）
- [ ] All Phase 3 tasks completed（Tab 集成）
- [ ] All Phase 4 tasks completed（联调与优化）
- [ ] Code self-tested（手动测试各 Agent 状态可视化）

### Code Quality
- [ ] Code style follows project conventions（TypeScript strict mode）
- [ ] 所有移植文件保留原始 MIT 版权声明
- [ ] 无 VS Code API 残留引用
- [ ] 无硬编码路径或 API Key

### Performance
- [ ] Tab 不可见时渲染循环已暂停
- [ ] Canvas 渲染帧率稳定 60fps
- [ ] 无内存泄漏（长时间运行测试）
- [ ] JSONL 文件读取使用增量方式（非全量重读）

### Testing
- [ ] 手动测试：Agent typing → 角色打字动画
- [ ] 手动测试：Agent reading → 角色看屏幕动画
- [ ] 手动测试：Agent idle → 角色休息动画
- [ ] 手动测试：Agent waiting → 气泡提示
- [ ] 手动测试：Agent spawn/despawn → 角色出现/消失特效
- [ ] 手动测试：无 Agent → 空场景 + 提示文字

### Documentation
- [ ] spec.md technical solution filled
- [ ] 所有移植代码标注来源（pixel-agents, MIT License）
