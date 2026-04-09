# Tasks: feat-runtime-session-output

## Task Breakdown

### 1. 后端 Session 缓冲区
- [x] AppState 新增 `session_output: Arc<Mutex<HashMap<String, Vec<StreamEvent>>>>` 和 `active_session_id: Mutex<Option<String>>` 字段
- [x] 初始化代码中添加新字段默认值
- [x] 修改 `runtime_session_start` 写入 `active_session_id`
- [x] 修改 `runtime_execute` spawned thread：emit 同时写入 session_output buffer
- [x] 新增 `get_active_session` 命令（返回 Option<ActiveSessionInfo>）
- [x] 新增 `clear_session_output` 命令
- [x] 在 `invoke_handler` 中注册新命令
- [x] 定义 `ActiveSessionInfo` struct

### 2. 前端类型定义
- [x] types.ts 添加 `ActiveSessionInfo` 接口

### 3. RuntimeOutputModal 组件
- [x] 创建 RuntimeOutputModal.tsx
- [x] 实现加载缓冲输出（invoke get_active_session）
- [x] 实现实时 chunk 监听（listen agent://chunk）
- [x] 实现自动滚动到底部
- [x] 实现输出类型标签（assistant/tool_use/system/raw）
- [x] 实现完成标记和进度指示
- [x] 实现 Clear 按钮和 Close 按钮

### 4. StatusBar 集成
- [x] 添加 activeSession 状态和轮询逻辑
- [x] 在 Claude Code runtime card 添加 "View Output" 按钮
- [x] 集成 RuntimeOutputModal

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 初始 task breakdown |
| 2026-04-08 | Implementation complete | All 4 tasks implemented, Rust cargo check + TypeScript tsc --noEmit pass |
