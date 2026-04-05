# Tasks: feat-pm-agent-provider-switch

## Task Breakdown

### 1. useAgentStream — runtimeId 动态化
- [ ] 将 `runtimeId` 从固定参数改为可变 state（支持外部覆盖）
- [ ] 暴露 `setRuntimeId` 方法供外部切换
- [ ] runtimeId 变更时断开旧 session，触发新 session 建立
- [ ] 保持 messages 不因 runtimeId 变更而清空

### 2. ProjectView — Settings 默认值关联
- [ ] 引入 `useSettings()` hook
- [ ] PM Agent 默认 runtimeId 从 `settings.llm.provider` 读取
- [ ] Req Agent 默认 runtimeId 保持 `'claude-code'`（或也跟随 Settings）
- [ ] 为 PM / Req 各维护独立的 provider 覆盖 state

### 3. ProjectView — Provider 下拉 UI
- [ ] 在 PM Agent 聊天头部（状态指示器旁）添加 provider 下拉按钮
- [ ] 下拉列表从 `settings.providers` 渲染所有已配置 provider
- [ ] 当前选中项有高亮标识
- [ ] 选择 provider 后更新 agent 的 runtimeId
- [ ] 为 Req Agent 聊天头部同样添加 provider 下拉
- [ ] API Key 未配置时显示警告提示（内联，非 alert）

### 4. 切换联动与边界处理
- [ ] 切换 provider 时保持聊天消息
- [ ] 未配置 API Key 的 provider 点击后提示用户
- [ ] dev mode（非 Tauri）下 provider 列表 fallback 为默认配置
- [ ] 切换 tab（PM ↔ Req）时恢复各自的 provider 覆盖状态

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | spec.md 重新生成 | 需求分析与文档创建 |
