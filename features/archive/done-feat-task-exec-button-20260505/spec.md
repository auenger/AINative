# Feature: feat-task-exec-button Task Board Pending Task 执行按钮

## Basic Information
- **ID**: feat-task-exec-button
- **Name**: Task Board Pending Task 执行按钮
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-30T19:00:00Z

## Description
在 Task Board 的 pending 状态 task 卡片上添加"开始执行"按钮，点击后弹出 Runtime Agent 选择对话框，确认后调用 Claude Code runtime 执行 `/run-feature {feature-id}` 全自动生命周期。

### 按钮禁用规则
1. **split parent task** → 按钮不可用（置灰）
2. **缺少文档**（spec.md / task.md / checklist.md 三者缺一不可）→ 按钮不可用
3. 只有满足：pending 状态 + 非 split parent + 三份文档齐全 → 可点击

### Agent 选择来源
- 从 `useAgentRuntimes()` 读取可用 runtime 列表
- 默认选中 `claude-code` runtime
- 确认后调用 `runtime_session_start` + `runtime_execute`，message 为 `/run-feature {feature-id}`

## User Value Points
1. **快速启动 Feature 执行** — 用户在 Task Board 看到完整待办 task 时，一键触发全自动执行流程，无需手动输入命令
2. **安全保护机制** — 通过禁用条件（split parent、文档不全）防止误操作执行不完整或不可执行的 feature

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — Task Board 主组件（含 FeatureCard、overlay、agent tab）
- `neuro-syntax-ide/src/lib/useQueueData.ts` — Queue 数据 hook（含 overlay 状态管理）
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — Runtime agent 检测 hook
- `neuro-syntax-ide/src/types.ts` — 类型定义

### Related Documents
- `/run-feature` skill 定义 — 全自动执行生命周期：start → implement → verify → complete

### Related Features
- `feat-task-execution-overlay`（已完成）— Execution Overlay + Ghost Card
- `feat-claude-code-runtime-monitor`（已完成）— Claude Code Runtime 状态监听

## Technical Solution

### 改动范围（仅修改 TaskBoard.tsx）

#### 1. 新增 state
- `showExecDialog: boolean` — 控制执行对话框显示
- `execTargetFeature: FeatureNode | null` — 当前要执行的 feature
- `selectedRuntimeId: string` — 用户选择的 runtime ID（默认 `claude-code`）
- `execDetail: Record<string, string> | null` — 用于判断文档完整性

#### 2. FeatureCard 组件改动
- 新增 prop: `queueColumn: QueueName`（用于判断是否 pending）
- 新增 prop: `isSplitParent: boolean`（queue.yaml 中 split=true 且有 children）
- 在卡片底部 tags 行下方添加"开始执行"按钮
- 按钮仅在 `queueColumn === 'pending'` 时渲染
- 按钮禁用条件：`isSplitParent || !hasAllDocs`
- 按钮样式：`PlayCircle` icon + "Run" 文字，primary 色调

#### 3. 执行确认对话框（ExecutionDialog）
- 轻量模态框，显示：
  - Feature ID + Name（只读）
  - Runtime Agent 选择下拉（从 `useAgentRuntimes().runtimes.filter(r => r.status === 'available')` 读取）
  - "确认执行" / "取消" 按钮
- 确认后执行逻辑：
  1. `setOverlay(featureId, { status: 'dispatching', action: 'develop' })`
  2. `invoke('runtime_session_start', { runtimeId: selectedRuntimeId })`
  3. `invoke('runtime_execute', { runtimeId: selectedRuntimeId, message: '/run-feature {id}', ... })`
  4. 监听 `agent://chunk` 事件，更新 overlay 状态

#### 4. 文档完整性检查
- 在点击"开始执行"时调用 `readDetail(feature.id)` 获取文档内容
- 检查 `detail['spec.md']` / `detail['task.md']` / `detail['checklist.md']` 是否全部存在且非空
- 不完整时按钮显示 tooltip 提示缺失项

### import 变更
- 已有 `PlayCircle` icon import（未使用，需确认或添加）

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在 Task Board 的 pending task 上看到"开始执行"按钮，以便一键触发 feature 的全自动执行。

### Scenarios (Given/When/Then)

#### Scenario 1: 完整 pending task 显示可点击的执行按钮
```gherkin
Given 一个 pending 状态的 feature task
  And 该 task 不是 split parent
  And 该 task 的 spec.md / task.md / checklist.md 三份文档都存在
When 用户在 Task Board 中看到该 task 卡片
Then 卡片上应显示"开始执行"按钮
  And 按钮为可点击状态（primary 色）
```

#### Scenario 2: 点击执行按钮弹出 Agent 选择对话框
```gherkin
Given 一个可点击的"开始执行"按钮
When 用户点击该按钮
Then 弹出执行确认对话框
  And 对话框显示 Feature ID 和名称
  And 对话框显示 Runtime Agent 下拉选择器
  And 下拉列表来自 useAgentRuntimes 的可用 runtime
  And 默认选中 claude-code
```

#### Scenario 3: 确认执行后触发 /run-feature
```gherkin
Given 执行确认对话框已打开
  And 用户选择了目标 runtime agent
When 用户点击"确认执行"
Then 系统调用 runtime_session_start 启动所选 runtime
  And 系统发送消息 "/run-feature {feature-id}"
  And 卡片 overlay 进入 dispatching 状态
  And 随后根据 streaming 事件更新为 streaming/writing/done 状态
```

#### Scenario 4: split parent task 按钮不可用
```gherkin
Given 一个 pending 状态的 split parent feature task（queue.yaml 中 split=true）
When 用户在 Task Board 中看到该 task 卡片
Then "开始执行"按钮应显示为禁用/置灰状态
  And 按钮带有 tooltip 说明"Split parent task, execute sub-features instead"
```

#### Scenario 5: 文档不全的 task 按钮不可用
```gherkin
Given 一个 pending 状态的 feature task
  And 该 task 的 spec.md 存在但 task.md 不存在
When 用户在 Task Board 中看到该 task 卡片
Then "开始执行"按钮应显示为禁用/置灰状态
  And 按钮带有 tooltip 说明缺失的文档名称
```

#### Scenario 6: 非 pending 状态的 task 不显示按钮
```gherkin
Given 一个 active/completed/blocked 状态的 feature task
When 用户在 Task Board 中看到该 task 卡片
Then 不应显示"开始执行"按钮
```

### UI/Interaction Checkpoints
- 按钮位置：Feature Card 底部 tags 行下方，右对齐
- 按钮样式：小尺寸，`PlayCircle` icon + "Run" 文字，primary 色调
- 禁用态：opacity-50，cursor-not-allowed，hover 时显示 tooltip
- 对话框样式：居中模态，与现有 Safe-close 确认弹窗风格一致
- 执行中：卡片显示 overlay（复用现有 overlay 系统）

### General Checklist
- 不引入新的 npm 依赖
- 复用现有 `useAgentRuntimes` / `useQueueData` hooks
- 复用现有 overlay 状态管理
- 不影响 board view / list view / graph view 的其他功能

## Merge Record
- **Completed**: 2026-05-05
- **Merged Branch**: feature/feat-task-exec-button
- **Merge Commit**: 5722685
- **Archive Tag**: feat-task-exec-button-20260505
- **Conflicts**: none
- **Verification**: PASSED (6/6 Gherkin scenarios, 0 TS errors in changed files)
- **Stats**: 3 commits, 4 files changed (327 lines added in TaskBoard.tsx)
