# Feature: feat-task-scheduler Task 定时调度服务

## Basic Information
- **ID**: feat-task-scheduler
- **Name**: Task 定时调度服务（一次性定时器 + 自动驱动 /run-feature 或 /dev-agent）
- **Priority**: 60
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-30

## Description

为 Task Board 添加定时调度能力。用户可以在 Task Board 的 Feature 卡片上设置一个一次性定时器，到指定时间自动驱动 `/run-feature <id>`（指定 feature）或 `/dev-agent`（自动执行所有 pending feature）。

核心场景：
- 下班前设定明天早上 9 点自动开始开发某个 feature
- 设定一个时间点让系统自动按队列顺序执行所有 pending feature
- 类似「闹钟」机制 — 设定一次、到点触发、触发后自动清除

## User Value Points

1. **Schedule Setting** — 在 Task Board 卡片上快速设定一次性定时触发，选择触发目标（指定 feature 或全部 pending）
2. **Auto-trigger Execution** — 后台调度服务到点自动驱动 `/run-feature` 或 `/dev-agent`，无需人工干预

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — Task Board 主视图，Feature 卡片渲染
- `neuro-syntax-ide/src/types.ts` — Task 类型定义，需扩展 Schedule 相关类型
- `neuro-syntax-ide/src/hooks/useQueueData.ts` — 队列数据 hook，可扩展调度逻辑
- `neuro-syntax-ide/src/hooks/useAgentRuntimes.ts` — Agent 运行时管理
- `feature-workflow/queue.yaml` — Feature 队列状态机（调度目标数据源）

### Related Documents
- `feature-workflow/config.yaml` — 工作流配置（max_concurrent, auto_start 等）

### Related Features
- feat-task-execution-overlay — 任务执行乐观状态（调度触发后的 UI 反馈可复用）
- feat-settings-workflow-config — Settings 工作流参数配置

## Technical Solution

### 1. 类型扩展（types.ts）

```typescript
interface TaskSchedule {
  id: string;                          // schedule uuid
  featureId: string | 'all-pending';   // 目标 feature ID，或 'all-pending' 表示执行全部
  triggerAt: string;                   // ISO 8601 时间戳
  action: 'run-feature' | 'dev-agent'; // 触发动作
  status: 'pending' | 'triggered' | 'missed' | 'cancelled';
  createdAt: string;
  triggeredAt?: string;
}
```

### 2. 调度状态管理

- 使用 React state + localStorage 持久化（FS-as-Database 原则：可存为 YAML 文件）
- 推荐方案：调度数据存储为 `feature-workflow/schedules.yaml`，前端通过 Tauri Command 或直接读取
- 当前阶段（Phase 1 Web 原型）：先用 localStorage + state，后续迁移到 Tauri FS

### 3. 后台调度服务

- 前端 `setInterval`（每 30s）检查 `schedules` 中 `status === 'pending'` 且 `triggerAt <= now` 的条目
- 触发时调用对应的 skill：`/run-feature <id>` 或 `/dev-agent`
- 触发后更新 status 为 `triggered`，记录 `triggeredAt`
- 如果 App 关闭期间错过了触发时间，标记为 `missed`

### 4. UI 设计

**Task Board 卡片扩展**：
- Feature 卡片新增「时钟」图标按钮（lucide `Clock`）
- 点击弹出小型 DateTime Picker 弹窗
- 选择时间 + 选择动作（指定 feature / 全部 pending）
- 确认后卡片显示定时状态（倒计时文字 + 时钟图标高亮）

**调度列表**：
- Task Board 顶部或侧边增加「Scheduled」筛选/排序
- 已调度的卡片显示倒计时 badge

## Acceptance Criteria (Gherkin)

### User Story
作为一个项目管理者，我希望能在 Task Board 上设定定时触发，这样我可以在下班前安排好明天的开发任务，系统会在指定时间自动启动。

### Scenarios

#### Scenario 1: 为指定 Feature 设置一次性定时触发
```gherkin
Given Task Board 上存在 pending 状态的 feature "feat-auth"
When 用户点击 "feat-auth" 卡片上的时钟按钮
  And 选择触发时间为 "明天 09:00"
  And 选择动作为 "run-feature"
  And 确认
Then 该卡片显示定时状态 badge "09:00 触发"
  And 调度列表中出现一条 pending 记录
```

#### Scenario 2: 定时执行所有 Pending Feature
```gherkin
Given Task Board 上存在 3 个 pending 状态的 feature
When 用户点击任意卡片上的时钟按钮
  And 选择触发时间为 "明天 09:00"
  And 选择动作为 "dev-agent（执行全部 pending）"
  And 确认
Then 调度列表中出现一条 pending 记录，目标为 "all-pending"
```

#### Scenario 3: 到点自动触发执行
```gherkin
Given 存在一条 pending 调度，triggerAt 为 "2026-05-01T09:00:00"，目标 feature "feat-auth"
When 系统时间到达 2026-05-01T09:00:00
Then 系统自动调用 /run-feature feat-auth
  And 调度状态更新为 triggered
  And 卡片上的定时 badge 变为 "已触发" 状态
```

#### Scenario 4: 取消已设置的定时
```gherkin
Given 存在一条 pending 调度
When 用户点击卡片上的时钟 badge
  And 选择 "取消定时"
Then 调度状态更新为 cancelled
  And 卡片上的定时 badge 消失
```

#### Scenario 5: 错过触发时间（Missed）
```gherkin
Given 存在一条 pending 调度，triggerAt 为 "2026-05-01T09:00:00"
When App 重新打开时已超过触发时间
Then 调度状态标记为 missed
  And 卡片上的 badge 显示 "已错过" 警告
  And 用户可选择 "立即执行" 或 "删除"
```

#### Scenario 6: 不能设置过去的时间
```gherkin
Given 用户正在设置定时触发
When 用户选择的时间早于当前时间
Then 确认按钮禁用
  And 显示提示 "请选择未来的时间"
```

### UI/Interaction Checkpoints
- [ ] Feature 卡片新增 Clock 图标按钮，hover 显示 tooltip "设置定时触发"
- [ ] 弹出 DateTime Picker 弹窗（遵循项目 glass-panel 样式）
- [ ] 弹窗内包含：时间选择、动作选择（指定 feature / 全部 pending）、确认/取消按钮
- [ ] 已调度的卡片显示倒计时 badge（如 "8h 后触发"）
- [ ] Task Board 顶部显示调度统计（如 "2 个定时任务"）
- [ ] 触发后 badge 变化：pending → triggered（绿色对勾） / missed（黄色警告）

### General Checklist
- [ ] 调度数据持久化（localStorage 或 YAML 文件）
- [ ] 后台检查间隔可配置（默认 30s）
- [ ] 调度状态变更日志写入 BottomPanel 日志区

## Merge Record

- **Completed**: 2026-05-05
- **Merged Branch**: feature/feat-task-scheduler
- **Merge Commit**: 09a9335
- **Archive Tag**: feat-task-scheduler-20260505
- **Conflicts**: none
- **Verification**: passed (6/6 Gherkin scenarios)
- **Stats**: 1 commit, 5 files changed, 809 insertions, 2 deletions, duration ~30min
