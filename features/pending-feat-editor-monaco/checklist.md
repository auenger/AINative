# Checklist: feat-editor-monaco

## Completion Checklist

### Development
- [x] 所有 task.md 中的前端任务项完成
- [x] Monaco Editor 替换原有 pre/code 标签
- [x] 多 Tab 管理功能完整
- [ ] Rust read_file/write_file commands 实现 (依赖 src-tauri/ 搭建)

### Code Quality
- [x] Monaco 主题与应用深色风格一致 (vs-dark)
- [ ] 文件保存为原子操作 (Rust 侧实现)
- [x] 大文件有保护机制 (>1MB 拒绝打开)

### Testing
- [ ] .tsx/.ts/.rs/.yaml/.md 语法高亮正确 (需要运行时验证)
- [ ] Cmd+S 保存到磁盘成功 (需要 Rust 后端)
- [x] 多 Tab 切换状态保持 (架构支持: OpenFileState Map)
- [ ] 外部修改感知正常 (依赖 Watcher)

### Documentation
- [x] spec.md Technical Solution 已填写
- [x] task.md Progress Log 已更新
