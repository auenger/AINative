# Tasks: fix-runtime-output-render

## Task Breakdown

### 1. 弹窗尺寸调整 (RuntimeOutputModal.tsx)
- [x] 修改 `modalSize` 初始值从 `{ w: 640, h: 480 }` 为 `{ w: 800, h: 560 }`

### 2. Rust 后端 — assistant 消息内容提取优化 (lib.rs)
- [x] 修改 `extract_content_blocks()` 同时提取 text 和 tool_use 块
- [x] tool_use 块格式化为 `[tool: {name}] {input_preview}`
- [x] system 消息提取 subtype/tools 等字段生成摘要

### 3. Rust 后端 — 新增 get_session_chunks 命令 (lib.rs)
- [x] 新增 `get_session_chunks` Tauri command
- [x] 返回 `Vec<StreamEvent>` 完整数组
- [x] 保留 `get_active_session` 向后兼容

### 4. 前端 — 使用 chunk 列表加载历史 (RuntimeOutputModal.tsx)
- [x] 优先调用 `get_session_chunks` 获取结构化数据
- [x] 逐个 chunk 渲染，保留类型标签和颜色
- [x] 向后兼容回退逻辑

### 5. 前端 — 优化空内容 chunk 显示 (RuntimeOutputModal.tsx)
- [x] 过滤完全空的 chunk（无 text 且无 error）
- [x] system 消息即使无 text 也显示有意义的摘要

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 初始任务拆解 |
| 2026-04-08 | All tasks completed | Rust extract_content_blocks 优化 + get_session_chunks 命令 + 前端 chunk 渲染 |
