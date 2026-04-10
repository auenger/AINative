# Tasks: feat-runtime-timeout-reminder

## Task Breakdown

### 1. Backend — Idle Watchdog 改造
- [x] 修改 `src-tauri/src/lib.rs` idle watchdog 线程逻辑：移除自动终止，改为发送 idle_warning 事件
- [x] 在 StreamEvent 中新增 idle_warning 支持（携带 idle_seconds 字段）
- [x] 调整 timeout_secs 参数语义（从"超时终止"变为"首次提醒阈值"）

### 2. Frontend — Idle Warning 事件处理
- [x] 更新 `useAgentStream.ts`：idle_warning 不触发 error 状态，而是更新 UI 提醒状态
- [x] 更新 `useReqAgentChat.ts`：同上处理
- [x] 在 types.ts 中添加 idle_warning 相关类型定义

### 3. Frontend — RuntimeOutputModal Idle 提醒 UI
- [x] 在 RuntimeOutputModal 底部添加 idle 提醒条组件
- [x] 监听 idle_warning 事件并显示等待时长
- [x] session 恢复输出时自动隐藏提醒条
- [x] 提醒条样式：警告色 + 半透明 + pulse 动画

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-09 | Feature created | 需求分析与技术方案完成 |
| 2026-04-09 | All tasks implemented | Backend watchdog refactored, frontend hooks + UI updated |
