# Tasks: feat-reveal-in-file-manager

## Task Breakdown

### 1. Tauri Backend
- [ ] 在 `lib.rs` 添加 `reveal_in_file_manager` command 函数
- [ ] 在 `invoke_handler` 注册该 command

### 2. 验证
- [ ] macOS 上右键文件 → Finder 打开并选中
- [ ] macOS 上右键文件夹 → Finder 打开并定位
- [ ] 错误路径 → 优雅提示

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Feature created | 前端代码已就绪，仅需 Rust 后端 command |
