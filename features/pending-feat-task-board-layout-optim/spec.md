# Feature: feat-task-board-layout-optim

## Basic Information
- **ID**: feat-task-board-layout-optim
- **Name**: Task Board 列排序与显示优化
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-27

## Description

调整 Task Board 看板页面的列排列顺序，将 Pending 列放在第一列、Active 列放在第二列，同时优化整体显示效果，提升信息可读性和交互体验。

当前列顺序：Active → Pending → Blocked → Completed
目标列顺序：Pending → Active → Blocked → Completed

## User Value Points

### VP1: 更符合直觉的列排列
用户打开 Task Board 时，最先看到的是待处理任务（Pending），而非正在进行的任务。这符合"先看队列再看进行中"的工作流习惯，让用户快速了解积压任务数量和优先级。

### VP2: 列头与卡片显示优化
改善列头信息密度和卡片视觉层次，让用户一眼区分任务优先级、大小、依赖关系，减少点击展开的次数。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — COLUMNS 常量定义列顺序（第 98-135 行），Board View 布局（第 538-597 行）
- `neuro-syntax-ide/src/lib/useQueueData.ts` — QueueState 数据结构，FeatureNode 接口
- `neuro-syntax-ide/src/types.ts` — Task 类型定义

### Related Documents
- `project-context.md` — TaskBoard 组件描述（看板卡片 + 甘特图 + 任务依赖）
- `feature-workflow/queue.yaml` — Feature 队列数据源

### Related Features
- `feat-task-execution-overlay` — 任务执行乐观状态（可能与卡片动画交互有关）
- `feat-task-graph-timeline` — 已完成的 Task Graph 视图

## Technical Solution

### 1. 列顺序调整
修改 `TaskBoard.tsx` 中 `COLUMNS` 数组的顺序：
- 将 `pending` 项移到数组第一位
- 将 `active` 项移到数组第二位
- 保持 `blocked` 和 `completed` 不变

### 2. 列头优化
- Pending 列使用更显眼的颜色标识（建议用 Clock 图标 + 蓝色系）
- Active 列保持 Zap 图标 + 高亮色
- 增加列内任务数量 badge 的视觉权重

### 3. 卡片显示优化
- 优先级指示器更醒目
- Size badge 颜色区分度提高
- 依赖关系摘要直接显示在卡片上（不依赖展开）

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望打开 Task Board 时先看到待处理任务队列，再看到正在进行的任务，以便快速掌握项目积压情况和当前进展。

### Scenarios

#### Scenario 1: 列顺序正确显示
```gherkin
Given 用户打开 Task Board 页面
When Board View 渲染完成
Then 列的顺序从左到右为 Pending → Active → Blocked → Completed
And Pending 列显示在页面最左侧
```

#### Scenario 2: Pending 列显示待处理任务
```gherkin
Given queue.yaml 中有 pending 状态的 Feature
When Task Board 加载数据
Then Pending 列显示所有 pending 状态的 Feature 卡片
And 卡片按 priority 降序排列
```

#### Scenario 3: 列头信息清晰
```gherkin
Given Task Board 已渲染
When 用户查看任意列头
Then 列头显示图标、标题、副标题和任务数量
And 任务数量以 badge 形式醒目展示
```

#### Scenario 4: 卡片优先级一目了然
```gherkin
Given Pending 列中有多个不同优先级的任务
When 用户浏览卡片列表
Then 高优先级任务通过颜色或大小有明显的视觉区分
And 用户无需点击即可判断任务优先级
```

### UI/Interaction Checkpoints
- [ ] Pending 列在页面最左侧，无需横向滚动即可看到
- [ ] Active 列紧随其后
- [ ] 列间有清晰的分隔线或间距
- [ ] 卡片 hover 效果正常
- [ ] 拖拽功能在新列顺序下正常工作

### General Checklist
- [ ] 不影响 List View 和 Graph View 的功能
- [ ] 不影响拖拽改变任务状态的交互
- [ ] 响应式布局在窄屏下仍可正常使用
