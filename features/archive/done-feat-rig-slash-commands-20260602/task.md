# Tasks: feat-rig-slash-commands

## Task Breakdown

### 1. 命令解析与路由
- [x] 在 `rig_runtime.rs` 新增 `parse_command()` 函数
- [x] 在 `execute()` 入口拦截 `/` 前缀消息，调用 `parse_command()`
- [x] 实现 5 个命令的处理函数：`cmd_clear`, `cmd_context`, `cmd_compact`, `cmd_help`, `cmd_model`
- [x] 未知命令返回提示信息

### 2. StreamEvent 扩展
- [x] `types.ts` 中 `StreamEvent.msg_type` 新增 `"command"` 值类型
- [x] 命令响应通过 `tx.send(StreamEvent{ msg_type: "command", ... })` 返回

### 3. 前端渲染
- [x] Chat 消息渲染组件识别 `msg_type === "command"`
- [x] 命令响应使用等宽字体 + 特殊背景色样式
- [x] 区别于普通 LLM 回复的视觉呈现

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-06-02 | Implementation complete | All 3 task groups done, cargo check passes |
| 2026-06-01 | Feature created | 初始 task breakdown |
