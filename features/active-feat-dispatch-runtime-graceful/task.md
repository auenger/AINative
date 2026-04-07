# Tasks: feat-dispatch-runtime-graceful

## Task Breakdown

### 1. 核心降级逻辑
- [ ] 在 `NewTaskModal.tsx` handleExecute 的 `invoke('dispatch_to_runtime')` 调用处添加 catch 降级
- [ ] catch 中检测 "not found" 错误，自动回退到 PM Agent 路径执行
- [ ] 降级时在 streaming output 中提示用户

### 2. TaskBoard 降级
- [ ] 在 `TaskBoard.tsx` agent 对话 dispatch 调用处添加同样的 catch 降级
- [ ] 降级时在 agentError 区域显示友好提示

### 3. Agent 选择 UI 优化
- [ ] 检测 Tauri 命令可用性，不可用时将外部 agent 标记为 disabled
- [ ] 添加 tooltip 或说明文字解释为什么不可用

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | Feature created | Pending implementation |
