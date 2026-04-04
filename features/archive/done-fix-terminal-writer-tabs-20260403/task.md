# Tasks: fix-terminal-writer-tabs

## Task Breakdown

### 1. Rust PtyInstance — 持久 Writer
- [x] 修改 `PtyInstance` 结构体，新增 `writer` 字段
- [x] 修改 `create()` 方法，通过 `take_writer()` 获取持久 writer（注：portable-pty 0.8 无 try_clone_writer，改用 take_writer 一次并持久持有）
- [x] 重写 `write()` 方法，使用持久 writer 替代 `take_writer()`
- [x] 确认 `kill()` 方法 drop 时 writer 自动清理

### 2. 前端 — 新增终端 Tab 排查与修复
- [x] 排查 EditorView.tsx "+" 按钮事件绑定
- [x] 排查 XTerminal 组件在新 tab 下是否正确 mount
- [x] 修复新增 tab 无法工作的问题（改用 click toggle 替代 hover dropdown + click-away 关闭）

### 3. 验证
- [x] `cargo build` 编译通过
- [ ] 手动测试终端输入无报错
- [ ] 手动测试新增/关闭 tab

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Bug 定位完成，方案确定 |
| 2026-04-03 | Implemented | Rust writer 持久化完成，前端 dropdown 改为 click toggle |
