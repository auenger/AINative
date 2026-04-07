# Tasks: feat-new-task-runtime-execute

## Task Breakdown

### 1. NewTaskModal.tsx — 替换外部 runtime 执行路径
- [x] 将 `dispatch_to_runtime` + `runtime_dispatch_chunk` 替换为 `runtime_session_start` + `runtime_execute` + `agent://chunk`
- [x] 添加 `fs://workspace-changed` 事件监听检测 feature 创建
- [x] 移除 `dispatchCommandAvailable` state 和 `isDispatchCommandAvailable()` 检查
- [x] 简化 `isAgentDisabled` — 仅基于 runtime status

### 2. NewTaskModal.tsx — 清理 UI 警告和 tooltip
- [x] 移除 "Backend command not ready" tooltip 和警告文案
- [x] 移除 `dispatchCommandAvailable === false` 相关的条件渲染

### 3. utils.ts — 清理 dispatch 工具函数
- [x] 删除 `isDispatchCommandAvailable()`
- [x] 删除 `isCommandNotFoundError()`
- [x] 删除 `resetDispatchAvailabilityCache()`

### 4. TaskBoard.tsx — 清理 dispatch 相关代码
- [x] 检查并移除 `isCommandNotFoundError` / `isDispatchCommandAvailable` 引用

### 5. 验证构建
- [x] 确保 Vite build 通过
- [x] 确认无 dispatch_to_runtime 相关残余引用

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
