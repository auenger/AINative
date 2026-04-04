# Tasks: feat-new-task-agent-dispatch

## Task Breakdown

### 1. NewTaskModal 组件骨架
- [x] 创建 `NewTaskModal.tsx` 组件文件
- [x] 实现 Step 导航（Agent 选择 → 需求输入 → 执行结果）
- [x] 集成 AnimatePresence + motion 动画
- [x] 连接 TaskBoard 的 `showNewTaskModal` state

### 2. Agent 选择器 UI
- [x] 渲染内置 PM Agent 卡片（硬编码，始终可用）
- [x] 集成 `useAgentRuntimes` 展示 Claude Code / Codex 状态
- [x] 实现卡片选中态、禁用态、hover 效果
- [x] 显示 runtime 状态指示灯（available/not-installed/unhealthy/busy）

### 3. 需求输入表单
- [x] 多行文本输入区域
- [x] 输入验证（非空检查）
- [x] 上一步/下一步导航

### 4. Agent 调度执行
- [x] 内置 PM Agent 路径：`invoke('run_agent_chat')` 调用
- [x] Claude Code 路径：`invoke('dispatch_to_runtime', { runtimeId: 'claude-code' })`
- [x] Codex 路径：`invoke('dispatch_to_runtime', { runtimeId: 'codex' })`
- [x] streaming 输出实时展示

### 5. 结果预览与入库
- [x] 解析 Agent 返回的结构化数据
- [x] Markdown 渲染 spec 预览
- [x] 确认后写入 `features/pending-{id}/` 目录
- [x] 更新 `feature-workflow/queue.yaml`
- [x] 触发 Task Board 刷新

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | All tasks implemented | NewTaskModal.tsx created, TaskBoard.tsx updated |
| 2026-04-04 | Feature created | 初始任务拆解 |
