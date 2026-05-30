# Tasks: feat-agent-runtime-workflow

## Task Breakdown

### 1. Agent Task Bridge
- [ ] 定义任务类型到 Agent Prompt 的模板映射
- [ ] 实现任务上下文组装（spec + tasks + project context → Agent 指令）
- [ ] 实现执行超时管理
- [ ] 实现结果解析（Agent 输出 → Feature 状态更新）

### 2. Tauri Backend
- [ ] 实现 `workflow_agent_execute` IPC Command
- [ ] 实现 `workflow_agent_status` IPC Command
- [ ] 实现 `workflow_agent_cancel` IPC Command
- [ ] 实现 `workflow_agent_approve` / `workflow_agent_reject` IPC Commands

### 3. 执行监控 UI
- [ ] Agent Execution 面板组件
- [ ] 实时日志流展示
- [ ] 代码变更列表展示
- [ ] Diff 查看器集成
- [ ] Approve/Reject 操作按钮

### 4. 状态回写
- [ ] Agent 完成后自动更新 queue.yaml
- [ ] 变更文件列表记录到 task.md
- [ ] checklist 自动勾选已完成项

### 5. Frontend Hook
- [ ] `useAgentWorkflow` Hook（管理 Agent 执行生命周期）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-09 | 规划完成 | 依赖 feat-agent-provider-core |
