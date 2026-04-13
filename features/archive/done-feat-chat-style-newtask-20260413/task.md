# Tasks: feat-chat-style-newtask

## Task Breakdown

### 1. PM Agent System Prompt 增强
- [x] 更新 `useAgentChat.ts` 中的 `PM_SYSTEM_PROMPT`，增加多轮对话引导指令
- [x] 添加需求澄清追问策略（模糊描述 → 追问关键维度）
- [x] 添加拆分协商提示（复杂需求 → 讨论 value points 拆分）
- [x] 添加 "准备创建" 标记逻辑（信息充分时建议确认）

### 2. NewTaskModal Chat 面板 UI
- [x] 改造 Step 2（`input-requirement`）为 chat 面板
- [x] 实现消息气泡列表（user/assistant 区分样式）
- [x] 添加底部输入框 + Send 按钮
- [x] 接入 `useAgentChat` 的 `sendMessage` + `messages` + streaming
- [x] 消息区域自动滚动到底部
- [x] 支持 Enter 发送、Shift+Enter 换行
- [x] "Create Feature" 按钮：对话 ≥1 轮后激活

### 3. generateFeaturePlan 接受 messages 上下文
- [x] 修改前端 `generateFeaturePlan()` 签名：接受 `ChatMessage[]` 而非 `string`
- [x] 修改 Rust `agent_generate_feature_plan` Command：接受 messages 数组（已支持，无需改动）
- [x] 确保 Plan 生成基于完整对话历史

### 4. 两条路径 UX 分离
- [x] PM Agent 路径：显示 chat 面板
- [x] External runtime 路径：保持原有 textarea 行为
- [x] 确保 `selectedAgent.isBuiltIn` 正确切换 UI

### 5. 测试与验证
- [x] 验证多轮对话流式输出正常
- [x] 验证 Create Feature 从 chat 上下文生成 Plan
- [x] 验证外部 runtime 路径不受影响
- [x] 验证 Modal 关闭/重开状态正确重置

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-13 | Feature created | 需求分析完成，spec/task 写入 |
| 2026-04-13 | Implementation complete | All 5 tasks implemented, TS check passed |
