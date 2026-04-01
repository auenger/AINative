# Checklist: feat-fs-database-engine

## Completion Checklist

### Development
- [ ] 所有 task.md 中的任务项完成
- [ ] 子任务 A (YAML 解析器) 完成
- [ ] 子任务 B (看板双向绑定) 完成
- [ ] 子任务 C (文件监听) 完成

### Code Quality
- [ ] YAML 解析有完善的错误处理
- [ ] 文件写回操作是原子性的 (先写临时文件再 rename)
- [ ] 文件监听有防抖，不会造成性能问题
- [ ] 并发操作不会导致数据丢失

### Testing
- [ ] fetch_queue_state 返回正确数据
- [ ] 拖拽卡片后 queue.yaml 变更正确
- [ ] 外部编辑 queue.yaml 后看板自动刷新
- [ ] features/ 新建/删除目录后看板响应
- [ ] 错误场景有友好提示 (YAML 损坏等)

### Documentation
- [ ] spec.md Technical Solution 已填写
- [ ] task.md Progress Log 已更新
