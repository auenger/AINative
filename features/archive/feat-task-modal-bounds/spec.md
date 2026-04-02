# Feature: feat-task-modal-bounds Task Modal 边界放宽 & 归档内容匹配

## Basic Information
- **ID**: feat-task-modal-bounds
- **Name**: Task Modal 边界放宽 & 归档内容匹配
- **Priority**: 60
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
Task 详情弹窗存在三个体验问题：
1. 向上拖动弹窗时高度被限制太多（`Math.max(0, ...)` 阻止负 Y 值），导致弹窗无法拖到视口上方区域
2. 宽度上限 `max-w-4xl`(896px) 固定值过窄，应放宽为不超过 app 宽度的 2/3
3. 已完成的 task 点击后无法加载对应的 spec.md / task.md / checklist.md，因为后端 archive 匹配只查找 `done-{id}-*` 模式，而归档目录实际命名为 `feat-{id}`（无 `done-` 前缀）

## User Value Points
- **VP1: 弹窗垂直拖拽自由度** — 弹窗可拖到视口顶部边缘附近，不再被强制锁定在初始位置以下
- **VP2: 弹窗水平尺寸上限放宽** — 用户可调整弹窗宽度至 app 宽度的 2/3，在大屏幕上获得更好的阅读体验
- **VP3: 已完成任务内容可查看** — 点击已完成的 feature 可正常加载并展示归档中的 3 个 MD 文件

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:270-271` — 拖拽边界约束
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:576-579` — 尺寸样式约束
- `neuro-syntax-ide/src-tauri/src/lib.rs:686-716` — 归档目录匹配逻辑
- `neuro-syntax-ide/src/lib/useQueueData.ts:208-217` — 前端 readDetail 调用

### Related Documents
- features/archive/feat-detail-modal-interaction/ — 上一次 modal 交互增强的 spec
- features/archive/feat-task-modal-improve/ — 上一次 modal 尺寸改进的 spec

### Related Features
- feat-detail-modal-interaction (已完成) — 原始拖拽 + resize 实现
- feat-task-modal-improve (已完成) — 尺寸和渲染改进

## Technical Solution

### VP1: 垂直拖拽边界放宽
**文件**: `TaskBoard.tsx:271`
**当前**: `const clampedY = Math.max(0, Math.min(window.innerHeight - 80, newY));`
**改为**: `const clampedY = Math.max(-window.innerHeight * 0.4, Math.min(window.innerHeight - 80, newY));`
允许向上拖动到视口高度 40% 的范围，同时保持底部边界不超出可视区域。

### VP2: 宽度上限放宽
**文件**: `TaskBoard.tsx:576-579`
**当前**: `max-w-4xl` (896px 固定值)
**改为**: 动态计算 `maxWidth: '66.67vw'` 或通过 CSS `max-w-[66.67vw]` 实现，确保不超过 app 宽度的 2/3。

### VP3: 归档目录匹配修复
**文件**: `lib.rs:702-716`
**当前**: fallback 只搜索 `done-{feature_id}-*` 模式
**改为**: 增加 `{feature_id}` 精确匹配。搜索策略变为：
1. 先尝试 `pending-{id}`, `active-{id}`, `{id}` (现有逻辑)
2. 再在 archive 目录中搜索 `done-{id}-*` (现有逻辑)
3. 最后在 archive 目录中搜索精确匹配 `{id}` (新增)

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Task 详情弹窗可以自由拖动到视口上方区域、宽度可调到 app 的 2/3、并且已完成任务能正常加载 MD 内容。

### Scenarios (Given/When/Then)

#### Scenario 1: 弹窗可向上拖动
```gherkin
Given Task 详情弹窗已打开
When 用户通过 header 区域将弹窗向上拖动
Then 弹窗可以移动到接近视口顶部的位置
And 弹窗不会被强制锁定在 y=0 以下
```

#### Scenario 2: 弹窗宽度可调到 app 的 2/3
```gherkin
Given Task 详情弹窗已打开
When 用户通过 resize 手柄调整弹窗宽度
Then 弹窗宽度可以扩展到接近 app 宽度的 2/3
But 不会超过 app 宽度的 2/3
```

#### Scenario 3: 已完成任务可加载归档 MD 内容
```gherkin
Given 一个已完成的 feature（归档在 features/archive/feat-xxx/ 目录下）
When 用户在 Task Board 中点击该 feature
Then 弹窗中的 spec / tasks / checklist 标签页可正常显示对应 MD 内容
```

#### Scenario 4: 带 done- 前缀的归档仍可匹配
```gherkin
Given 一个已完成的 feature（归档在 features/archive/done-feat-xxx-20260402/ 目录下）
When 用户在 Task Board 中点击该 feature
Then 弹窗中的 MD 内容仍可正常加载
```

### UI/Interaction Checkpoints
- 弹窗向上拖动时不突然停止
- 弹窗 resize 时宽度可达视口 2/3
- 已完成 feature 点击后显示内容而非空白

### General Checklist
- 不影响现有拖拽和 resize 的基本功能
- 不影响 pending/active feature 的正常加载
- 约束值合理，不会导致弹窗完全移出可视区域

## Merge Record
- **Completed**: 2026-04-02
- **Merged Branch**: feature/task-modal-bounds
- **Merge Commit**: 07cca6c
- **Archive Tag**: feat-task-modal-bounds-20260402
- **Conflicts**: none
- **Verification**: passed (8/8 tasks, 4/4 scenarios)
- **Evidence**: features/archive/feat-task-modal-bounds/evidence/verification-report.md
