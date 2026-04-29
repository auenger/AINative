# Feature: feat-task-execution-overlay 任务执行乐观状态

## Basic Information
- **ID**: feat-task-execution-overlay
- **Name**: 任务执行乐观状态（Execution Overlay + Ghost Card）
- **Priority**: 70
- **Size**: L
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-27

## Description
在文件驱动状态之上添加前端乐观状态层，解决两个核心延迟场景：
1. **现有 Feature 的 AI 操作反馈** — Agent tab 触发 review/modify/develop 后，卡片即时显示执行进度
2. **新 Feature 创建的即时可见** — NewTaskModal 创建 Feature 后，目标列立即出现占位卡片，不等文件系统刷新

### 背景问题

#### 文件驱动的状态延迟链路
```
当前架构 — 所有 UI 更新都依赖文件系统变更

  用户操作               前端状态                     文件系统                Rust 后端
  ────────              ────────                    ────────               ─────────
  
  Agent Send     →   agentSending=true      →    (无变更)
                        ↓
                     agent://chunk 流式事件  →    (无变更, AI 思考/写码中)
                        ↓
                     chunk.is_done           →    AI 修改 spec/task/md 文件
                                                     ↓
                                                 fs://workspace-changed
                                                     ↓
                     refresh()              ←    fetch_queue_state (读YAML)
                     queueState 更新             read_feature_detail (读MD)
                     
  ← 整个"暗区"期间 Board 卡片毫无变化，10s~120s →
  
  NewTask Create  →   step='executing'       →   (无变更)
                     streamingOutput...       →   (AI 生成plan中)
                     createFeature(plan)      →   create_feature_from_agent
                                                     ↓
                                                 写 features/pending-xxx/
                                                 更新 queue.yaml
                                                     ↓
                                                 fs://workspace-changed
                                                     ↓
                     refresh()              ←    fetch_queue_state
                     
  ← 新卡片出现前有 5s~30s 延迟，Board 看起来"什么都没发生" →
```

#### 延迟根源分析
| 触发源 | 文件变更点 | 典型延迟 | 是否需要 overlay |
|--------|-----------|---------|-----------------|
| Agent tab Send (review/modify/develop) | AI 写 spec.md/task.md/代码 | 10s~120s | **层面 A** |
| NewTaskModal Create Feature | create_feature_from_agent → 写目录+queue.yaml | 5s~30s | **层面 B** |
| Drag & Drop 移动列 | update_task_status → queue.yaml | <1s | 不需要 |
| 手动 Refresh | 重新读文件 | <1s | 不需要 |

## User Value Points
1. **VP1: 现有卡片执行状态反馈** — Agent tab 操作后 Board 卡片即时显示执行进度（dispatching → streaming → writing → done），含脉冲动画和输出预览
2. **VP2: 新 Feature 幽灵卡片** — 创建 Feature 后目标列立即出现半透明占位卡片，消除"创建但看不到"的空白期
3. **VP3: 状态完成自动同步** — AI 完成文件写入后，overlay 自动消失、幽灵卡片自动替换为真实卡片，无感切换

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:429-534` — handleAgentSend() 执行流程
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:169-278` — FeatureCard 组件
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx:380-517` — handleExecute() 创建流程
- `neuro-syntax-ide/src/lib/useQueueData.ts:59-283` — Queue 数据层 + fs://workspace-changed 监听

### Related Documents
- fs://workspace-changed 事件协议
- agent://chunk 流式事件协议（type: assistant/system/raw/stderr, is_done, error）

### Related Features
- feat-agent-conversation — Agent tab 交互
- feat-chat-style-newtask — NewTask 对话流程
- feat-modal-session-store — Session 持久化（互补，不依赖）

## Technical Solution

### 架构概览
```
                    ┌──────────────────────────────────────────┐
                    │         useQueueData (扩展)               │
                    │                                          │
  fs://workspace-   │  ┌──────────────┐   ┌────────────────┐  │
  changed → refresh │  │ queueState   │   │ overlayState   │  │
                    │  │ (文件驱动)    │   │ (前端乐观)      │  │
                    │  │ 真实卡片数据  │   │ 覆盖层+幽灵卡片 │  │
                    │  └──────────────┘   └────────────────┘  │
                    │         ↓                   ↓            │
                    │  ┌──────────────────────────────────────┐│
                    │  │        TaskBoard 渲染合并             ││
                    │  │  真实卡片 + overlay覆盖层             ││
                    │  │  幽灵卡片 + 真实卡片合并渲染          ││
                    │  └──────────────────────────────────────┘│
                    └──────────────────────────────────────────┘
```

### 数据结构

```typescript
// ─── 层面 A: 现有卡片的执行覆盖 ───

interface TaskExecutionOverlay {
  featureId: string;
  status: 'dispatching' | 'streaming' | 'writing' | 'done' | 'error';
  startedAt: number;
  action: AgentActionType;  // review | modify | develop
  outputPreview?: string;   // 最后 2 行 streaming 文本
}

// ─── 层面 B: 新 Feature 幽灵卡片 ───

interface GhostCard {
  tempId: string;            // 临时 ID（如 "ghost-{timestamp}"）
  featureId: string | null;  // 创建成功后填入真实 ID
  name: string;              // 预览名称
  targetQueue: QueueName;    // 目标列（通常是 'pending'）
  status: 'creating' | 'created' | 'syncing' | 'error';
  startedAt: number;
  preview?: string;          // plan 摘要
}

// ─── 合并状态 ───

interface OverlayState {
  taskOverlays: Map<string, TaskExecutionOverlay>;  // key = featureId
  ghostCards: GhostCard[];
}
```

### 层面 A: 现有卡片状态机

```
handleAgentSend() 调用
  │
  ├─ setOverlay(featureId, { status: 'dispatching' })  ← 立即生效
  │
  ├─ agent://chunk 首次收到事件
  │   └─ setOverlay(featureId, { status: 'streaming', outputPreview })
  │       (每次 chunk 更新 outputPreview = last 2 lines)
  │
  ├─ chunk.is_done
  │   └─ setOverlay(featureId, { status: 'writing' })
  │
  ├─ fs://workspace-changed → refresh()
  │   └─ queueState 更新后 → clearOverlay(featureId)  ← 无感切换
  │
  └─ catch error
      └─ setOverlay(featureId, { status: 'error' })
          (30s 后自动清理)
```

**关键：overlay 与 queueState 的合并策略**
- `queueState` 是真实数据源，overlay 是临时覆盖层
- 渲染时：`最终卡片 = queueState 中的卡片 + overlay 视觉层叠加`
- overlay 只影响视觉（边框、动画、状态标签），不修改 queueState 数据
- refresh() 后 queueState 包含了 AI 写入的最新数据，此时清除 overlay 即可

### 层面 B: 幽灵卡片生命周期

```
NewTaskModal handleExecute()
  │
  ├─ 步骤1: generateFeaturePlan() 返回 plan
  │   └─ onGhostCardCreate({ name: plan.name, targetQueue: 'pending' })
  │       → Board pending 列顶部立即出现半透明卡片
  │
  ├─ 步骤2: createFeature('', plan) 返回 featureId
  │   └─ updateGhostCard(tempId, { featureId, status: 'created' })
  │       → 幽灵卡片变为半实线（有了真实 ID）
  │
  ├─ 步骤3: fs://workspace-changed → refresh()
  │   └─ queueState 中出现了真实的 featureId
  │       → removeGhostCard(tempId)  ← 真实卡片替代幽灵卡片
  │
  └─ 外部 runtime 路径:
      ├─ runtime_execute 发送 /new-feature 命令
      ├─ agent://chunk 流式输出 → 更新幽灵卡片 preview
      └─ fs://workspace-changed → 同上
```

**幽灵卡片与真实卡片的合并渲染**
```typescript
// 在 pending 列中：幽灵卡片置顶，保证视觉可见
const pendingItems = [
  ...ghostCards.filter(g => g.targetQueue === 'pending'),  // 幽灵卡片置顶
  ...queueState.pending,                                    // 真实卡片
];
// 渲染时 GhostCard 用 <GhostFeatureCard> 组件，视觉区分（半透明 + 脉冲）
```

### 改动点清单

1. **`useQueueData.ts`** — 扩展
   - 新增 `overlayState` + `setOverlay` / `clearOverlay`
   - 新增 `ghostCards` + `addGhostCard` / `updateGhostCard` / `removeGhostCard`
   - refresh() 后自动清理 done overlay 和 syncing ghost card
   - 错误 overlay 30s 自动清理

2. **`TaskBoard.tsx`** — Agent tab 集成
   - handleAgentSend 开头调用 setOverlay(featureId, { status: 'dispatching' })
   - agent://chunk listener 内更新 overlay status 和 outputPreview
   - 列渲染合并 ghostCards

3. **`FeatureCard`** — overlay 视觉层
   - 接收 overlay prop，条件渲染覆盖层
   - 边框色 + 脉冲动画 + 状态 badge + output preview

4. **`GhostFeatureCard`** — 新组件
   - 半透明卡片，脉冲边框
   - 显示 "Creating..." + 名称预览
   - 创建成功后过渡为半实线

5. **`NewTaskModal.tsx`** — 幽灵卡片触发
   - 新增 prop `onGhostCardCreate?: (ghost: GhostCard) => void`
   - handleExecute 中 generateFeaturePlan 成功后立即触发

### 视觉设计

**层面 A — 现有卡片 overlay**
- `dispatching`: 边框 `border-warning/50`，右上角黄色 mini spinner
- `streaming`: 边框 `border-primary/50` + pulse 动画，底部截取最后 1-2 行输出
- `writing`: 边框 `border-secondary/50`，微弱 pulse + "Syncing..."
- `done`: 边框 `border-tertiary/50`，1.5s 绿色闪烁后 fadeout
- `error`: 边框 `border-[#ffb4ab]/50`，显示错误一行摘要，30s 后 fadeout

**层面 B — 幽灵卡片**
- 整体 `opacity-60` + `border-dashed border-primary/30`
- 脉冲呼吸动画 (`animate-pulse`)
- 顶部状态栏: "✨ Creating..." + spinner
- 创建完成: 虚线→实线过渡，状态变为 "Synced ✓"

## Acceptance Criteria (Gherkin)
### User Story
As a user triggering AI actions or creating new features from the Task Board, I want to see immediate visual feedback on the board, so that I know the system is working without waiting for file system changes.

### Scenarios — 层面 A (现有卡片)

#### Scenario: Agent send shows dispatching immediately
```gherkin
Given Feature X exists in the pending column
And the Feature Detail Modal Agent tab is open
When the user clicks "Send to Claude Code"
Then Feature X's card immediately shows a yellow border and spinner
And the card status badge shows "dispatching"
```

#### Scenario: Streaming updates card preview
```gherkin
Given Feature X's overlay is in "streaming" status
When agent://chunk events deliver "Reviewing spec...\nFound 3 issues"
Then Feature X's card border pulses blue
And the card bottom shows "Found 3 issues" (last line)
```

#### Scenario: Done overlay auto-cleanup after refresh
```gherkin
Given Feature X's overlay is in "done" status
When fs://workspace-changed triggers refresh
Then the overlay is removed
And the card shows the updated real data from queueState
```

#### Scenario: Multiple concurrent overlays
```gherkin
Given Feature A's overlay is "streaming"
When the user triggers develop on Feature B
Then Feature A continues streaming animation
And Feature B shows "dispatching"
And both are independent
```

### Scenarios — 层面 B (幽灵卡片)

#### Scenario: Ghost card appears on feature creation
```gherkin
Given the user is in NewTaskModal and has chatted with PM Agent
When the user clicks "Create Feature" and the plan is generated
Then a semi-transparent "Creating..." card appears at the top of the pending column (above all existing cards)
And the card shows the feature name from the plan
```

#### Scenario: Ghost card replaced by real card
```gherkin
Given a ghost card exists in pending column with name "Session Store"
When createFeature() completes and fs://workspace-changed fires
Then the ghost card is removed
And a real card for "Session Store" appears in the same position
```

#### Scenario: External runtime ghost card with streaming
```gherkin
Given the user selected Claude Code in NewTaskModal
When the user clicks "Create Feature"
Then a ghost card appears in pending
And agent://chunk output updates the ghost card preview text
```

### UI/Interaction Checkpoints
- Overlay 不阻止卡片点击（可正常打开 Feature Detail）
- 幽灵卡片也可点击，显示简化的"Creating..."状态
- 动画使用 CSS transform/opacity，不影响 layout 性能
- 切换 Board/List/Graph 视图时 overlay 状态保持

### General Checklist
- Overlay/Ghost 状态纯前端内存，不写入文件系统
- 不影响 queue.yaml 文件内容
- 页面刷新后 overlay/ghost 自然清除
- refresh() 是最终数据源，overlay/ghost 仅是中间态补充

## Merge Record

- **Completed**: 2026-04-29T19:30:00Z
- **Branch**: feature/feat-task-execution-overlay
- **Merge Commit**: 3a16279
- **Archive Tag**: feat-task-execution-overlay-20260429
- **Conflicts**: none
- **Verification**: passed (7/7 Gherkin scenarios)
- **Stats**: 5 files changed, 441 insertions, 62 deletions, 1 commit
