# Tasks: feat-task-exec-button
## Task Breakdown

### 1. FeatureCard — 添加"开始执行"按钮与禁用逻辑
- [ ] FeatureCard 新增 props: `queueColumn`, `isSplitParent`, `onExecClick`
- [ ] 在 pending 卡片底部 tags 行下方渲染"Run"按钮（PlayCircle icon）
- [ ] 实现禁用逻辑：split parent 或文档不全 → 置灰 + tooltip
- [ ] Board view 渲染时传入 `isSplitParent`（从 queue.yaml parents 推断）

### 2. ExecutionDialog — Runtime Agent 选择对话框
- [ ] 新增 ExecutionDialog 组件（轻量模态框）
- [ ] 显示 Feature ID + Name
- [ ] Runtime Agent 下拉选择器（从 useAgentRuntimes 可用列表）
- [ ] 默认选中 claude-code
- [ ] 确认/取消按钮

### 3. 执行调度 — 调用 /run-feature + overlay 集成
- [ ] 确认后调用 runtime_session_start + runtime_execute
- [ ] message 为 `/run-feature {feature-id}`
- [ ] 复用现有 overlay 状态流（dispatching → streaming → writing → done/error）
- [ ] 监听 agent://chunk 更新 overlay
- [ ] Dev 模式 fallback（模拟执行流程）

### 4. 文档完整性检查
- [ ] 点击"Run"时调用 readDetail 获取文档内容
- [ ] 检查 spec.md / task.md / checklist.md 三者全部存在且非空
- [ ] 禁用时 tooltip 显示缺失文档名称

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Feature created | 初始任务拆解 |
