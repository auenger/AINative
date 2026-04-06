# Tasks: feat-agent-conversation

## Task Breakdown

### 1. TaskBoard.tsx — Agent Tab UI
- [x] 在 Feature Detail Modal tab bar 中新增 "Agent" tab（仅未完成 feature 显示）
- [x] Agent tab 内容区：runtime 状态检测 + 下拉选择
- [x] 操作类型 radio：Review / Modify / Develop
- [x] textarea 补充说明输入（Modify 必填，其他选填）
- [x] Send 按钮及 disabled 逻辑

### 2. TaskBoard.tsx — dispatch 逻辑
- [x] 实现 Review dispatch：读取 spec.md → 拼装 prompt → dispatch_to_runtime /new-feature
- [x] 实现 Modify dispatch：读取 spec.md + task.md → 拼装 prompt → dispatch_to_runtime /new-feature
- [x] 实现 Develop dispatch：dispatch_to_runtime /dev-agent + feature ID

### 3. TaskBoard.tsx — 流式输出与刷新
- [x] 监听 runtime_dispatch_chunk 事件，流式显示执行结果
- [x] 执行完成后调用 readDetail + refresh 刷新内容

### 4. types.ts — 类型补充
- [x] 如需要，补充 AgentActionType 等类型定义

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks completed | Added Agent tab with Review/Modify/Develop actions, streaming output, auto-refresh |
