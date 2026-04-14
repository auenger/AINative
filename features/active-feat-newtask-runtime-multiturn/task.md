# Tasks: feat-newtask-runtime-multiturn

## Task Breakdown

### 1. 外部 Runtime Chat Panel
- [ ] NewTaskModal 中：外部 Runtime 路径的 textarea 替换为 chat panel
- [ ] 复用内置 PM 的消息气泡组件样式
- [ ] 维护 messages 数组（user/assistant），每条用户消息通过 runtime_execute 发送
- [ ] 流式响应通过 agent://chunk 事件实时追加到 assistant 消息

### 2. Create Feature 触发
- [ ] "Create Feature" 按钮在至少 1 条用户消息后可用
- [ ] 点击后将对话上下文组装为 `/new-feature {context}` 命令
- [ ] 通过 runtime_execute 发送给外部 Runtime
- [ ] 监听 fs://workspace-changed 捕获创建结果，跳转 result step

### 3. 回归验证
- [ ] 内置 PM 路径功能不受影响
- [ ] Claude Code 多轮对话流程通畅
- [ ] Modal 打开/关闭时 session 正确 cleanup

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
