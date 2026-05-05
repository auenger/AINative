# Feature: feat-task-board-search-sort

## Basic Information
- **ID**: feat-task-board-search-sort
- **Name**: Task Board 模糊搜索与时间排序
- **Priority**: 65
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-05

## Description

为 Task Board tab 增加模糊搜索和时间排序能力，让用户能在大量 feature 卡片中快速定位目标任务。

### 痛点
- 随着 feature 数量增多（当前已有 50+ completed），用户难以在 Board 视图中找到特定任务
- 没有按时间维度浏览的能力，无法快速找到最近创建或完成的 feature
- 只能靠 priority 排序，缺少灵活的排序方式

## User Value Points

### VP1: 模糊搜索
用户可以在搜索框中输入关键词，实时过滤所有列（pending/active/blocked/completed）中的 feature 卡片。搜索范围覆盖 feature 的 id、name 字段。

### VP2: 时间排序
用户可以切换排序维度：按 priority（默认）或按时间（created_at / completed_at）升降序排列。时间排序让用户能快速定位最近操作或最早创建的任务。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — 主看板组件，当前无搜索/排序 UI
- `neuro-syntax-ide/src/lib/useQueueData.ts` — 数据 hook，`FeatureNode` 含 `completed_at` 字段
- `neuro-syntax-ide/src/types.ts` — `QueueName`, `TaskExecutionOverlay`, `GhostCard` 类型
- `feature-workflow/queue.yaml` — 数据源，每个 feature 有 `created_at` 和 `completed_at`

### Related Documents
- project-context.md — 项目架构和组件映射

### Related Features
- feat-task-board-layout-optim (completed) — 列排序与显示优化
- feat-task-graph-timeline (completed) — Graph 时间轴视图

## Technical Solution

### UI 设计

在 Board 视图顶部（列标题区域上方）增加一个工具栏：

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 [搜索 feature 名称或 ID...]     [排序: Priority ▼] [↑↓]     │
├───────────┬───────────┬───────────┬──────────────────────────────┤
│ Pending   │ Active    │ Blocked   │ Completed                   │
```

### 搜索实现
1. 在 TaskBoard 组件顶部新增搜索栏（Search icon + input）
2. 使用 `useState` 管理 `searchQuery` 状态
3. 用 `useMemo` 对每列的 features 做过滤：
   - 将 searchQuery 和 feature.id、feature.name 都转小写
   - 支持空格分词（多个关键词 AND 匹配）
4. 搜索为空时显示全部，搜索时实时过滤（无 debounce，feature 数量有限）
5. 搜索结果高亮匹配文本

### 排序实现
1. 新增 `sortMode` state：`'priority-desc'` | `'time-desc'` | `'time-asc'` | `'priority-asc'`
2. 排序下拉菜单，使用 ChevronDown icon + 弹出选项
3. 默认 `'priority-desc'`（保持当前行为）
4. 时间排序：
   - pending/active/blocked: 按 `created_at` 排序
   - completed: 按 `completed_at` 排序
   - 无时间字段的 feature 排在末尾
5. 用 `useMemo` 对每列 features 排序

### i18n
- 搜索框 placeholder: `t('taskBoard.searchPlaceholder')` → "搜索 feature 名称或 ID..."
- 排序选项: `t('taskBoard.sortPriorityDesc')` 等

### 样式
- 搜索栏: glass-panel 风格，与项目设计系统一致
- 排序按钮: 紧凑的下拉选择器
- 工具栏在 Board/List 视图显示，Graph 视图隐藏

## Acceptance Criteria (Gherkin)

### User Story
作为项目管理者，我希望能在 Task Board 中搜索和排序 feature，以便快速定位目标任务。

### Scenarios (Given/When/Then)

#### Scenario 1: 模糊搜索 — 基本搜索
```gherkin
Given Task Board 显示了多个 feature 卡片
When 用户在搜索框输入 "git"
Then 所有列中仅显示 id 或 name 包含 "git" 的 feature
And 不匹配的 feature 卡片被隐藏
```

#### Scenario 2: 模糊搜索 — 多关键词 AND 匹配
```gherkin
Given Task Board 显示了多个 feature 卡片
When 用户在搜索框输入 "feat agent"
Then 仅显示同时匹配 "feat" 和 "agent" 的 feature
```

#### Scenario 3: 模糊搜索 — 清空搜索
```gherkin
Given 搜索框中有内容且 feature 被过滤
When 用户清空搜索框
Then 所有 feature 重新显示
```

#### Scenario 4: 时间排序 — 降序
```gherkin
Given Task Board 当前按 priority 排序
When 用户切换排序为 "时间（最新优先）"
Then pending/active/blocked 列按 created_at 降序排列
And completed 列按 completed_at 降序排列
```

#### Scenario 5: 时间排序 — 升序
```gherkin
Given Task Board 当前按时间降序排序
When 用户切换排序为 "时间（最早优先）"
Then 各列按对应时间字段升序排列
```

#### Scenario 6: 搜索 + 排序联合使用
```gherkin
Given Task Board 搜索框过滤了部分 feature
And 排序设置为时间降序
Then 过滤后的结果仍按时间降序排列
```

### UI/Interaction Checkpoints
- [ ] 搜索栏在 Board 视图列上方正确渲染
- [ ] 搜索栏在 List 视图正确渲染
- [ ] Graph 视图不显示搜索栏
- [ ] 排序下拉菜单正确弹出和收起
- [ ] 搜索输入有 focus 样式（ring 高亮）
- [ ] 排序切换有视觉反馈

### General Checklist
- [ ] 使用 `cn()` 合并样式
- [ ] 搜索逻辑不引入外部依赖
- [ ] i18n key 添加中英文翻译
- [ ] 不影响拖拽等现有功能
