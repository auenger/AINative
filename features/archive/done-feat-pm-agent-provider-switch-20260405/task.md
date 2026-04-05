# Tasks: feat-pm-agent-provider-switch

## Task Breakdown

### 1. useAgentStream — runtimeId 动态化
- [x] 将 `runtimeId` 从固定参数改为可变 state（支持外部覆盖）
- [x] 暴露 `setRuntimeId` 方法供外部切换
- [x] runtimeId 变更时断开旧 session，触发新 session 建立
- [x] 保持 messages 不因 runtimeId 变更而清空

### 2. ProjectView — Settings 默认值关联
- [x] 引入 `useSettings()` hook
- [x] PM Agent 默认 runtimeId 从 `settings.llm.provider` 读取
- [x] Req Agent 默认 runtimeId 保持 `'claude-code'`（或也跟随 Settings）
- [x] 为 PM / Req 各维护独立的 provider 覆盖 state

### 3. ProjectView — Provider 下拉 UI
- [x] 在 PM Agent 聊天头部（状态指示器旁）添加 provider 下拉按钮
- [x] 下拉列表从 `settings.providers` 渲染所有已配置 provider
- [x] 当前选中项有高亮标识
- [x] 选择 provider 后更新 agent 的 runtimeId
- [x] 为 Req Agent 聊天头部同样添加 provider 下拉
- [x] API Key 未配置时显示警告提示（内联，非 alert）

### 4. 切换联动与边界处理
- [x] 切换 provider 时保持聊天消息
- [x] 未配置 API Key 的 provider 点击后提示用户
- [x] dev mode（非 Tauri）下 provider 列表 fallback 为默认配置
- [x] 切换 tab（PM ↔ Req）时恢复各自的 provider 覆盖状态

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | spec.md 重新生成 | 需求分析与文档创建 |
| 2026-04-06 | Task 1-4 全部实现 | useAgentStream 动态 runtimeId + ProjectView provider 下拉 UI |
