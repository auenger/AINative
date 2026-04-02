# Feature: feat-view-state-persistence View 状态持久化

## Basic Information
- **ID**: feat-view-state-persistence
- **Name**: View 状态持久化
- **Priority**: 75
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: [feat-terminal-polish]
- **Created**: 2026-04-02

## Description

所有 tab/view 切换时状态应被保留。当前 App.tsx 通过 switch 语句条件渲染视图，切换时旧视图被 unmount，导致所有组件状态丢失（编辑器中打开的文件、终端标签、光标位置、滚动偏移等）。

需要改为"全部挂载、CSS 隐藏"策略，使视图切换时状态完整保留。

## User Value Points

### VP1: Tab 状态保持
用户在任意视图中的操作状态（打开的文件、编辑内容、滚动位置、选中的终端标签等）在切换到其他 tab 后再切回来时完整保留。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/App.tsx` — renderView() switch 语句，视图路由逻辑
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 编辑器视图，包含文件打开、终端标签等丰富状态
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — 看板视图
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 项目视图
- `neuro-syntax-ide/src/components/views/WorkflowEditor.tsx` — 工作流视图
- `neuro-syntax-ide/src/components/views/MissionControl.tsx` — 仪表盘视图

### Related Documents
- project-context.md — 视图路由使用 useState + switch 模式
- CLAUDE.md — 不使用 React Router，保持 useState + switch 视图切换

### Related Features
- feat-editor-monaco (已完成) — Monaco 编辑器集成
- feat-native-terminal (已完成) — xterm.js 终端
- feat-terminal-polish (pending) — 终端主题与显隐控制，依赖本 feature

## Technical Solution

### 核心改动：renderView() → 全量挂载 + CSS 隐藏

将 App.tsx 中的 switch 条件渲染改为：所有视图始终挂载，通过 CSS `display` 或 `visibility` 控制显隐。

```tsx
// Before: switch 渲染（unmount 非活跃视图）
function renderView() {
  switch (activeView) {
    case 'editor': return <EditorView ... />;
    // ...
  }
}

// After: 全量挂载 + CSS 隐藏（保留所有视图状态）
<div className={cn("hidden", activeView === 'editor' && "block")}>
  <EditorView ... />
</div>
```

### 注意事项
- `hidden` / `block` (Tailwind) 即 `display: none` / `display: block`
- 被隐藏的视图 DOM 仍存在，React 状态完整保留
- 需确认隐藏视图不会产生副作用（如定时器、轮询等），必要时在视图内用 visibility hook 控制

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望切换 tab 后再切回来时，之前的操作状态（打开的文件、终端标签、编辑内容）仍然保持不变。

### Scenarios (Given/When/Then)

#### Scenario 1: 编辑器文件状态保持
```gherkin
Given 用户在 Editor 视图中打开了 "src/App.tsx" 文件
And 光标在第 42 行
When 用户切换到 Tasks 视图
And 然后切换回 Editor 视图
Then "src/App.tsx" 文件仍然处于打开状态
And 光标仍在第 42 行
And 编辑器内容未被重置
```

#### Scenario 2: 终端标签状态保持
```gherkin
Given 用户在 Editor 视图中打开了 2 个终端标签（bash + claude）
And bash 标签处于活跃状态
When 用户切换到 Mission Control 视图
And 然后切换回 Editor 视图
Then 2 个终端标签仍然存在
And bash 标签仍然是活跃状态
```

#### Scenario 3: 多视图交叉切换
```gherkin
Given 用户在 Project 视图中进行了 PM Agent 对话
When 用户切换到 Workflow 视图浏览画布
And 然后切换到 Tasks 视图查看看板
And 最后切回 Project 视图
Then PM Agent 对话历史完整保留
And 滚动位置保持不变
```

### UI/Interaction Checkpoints
- Tab 切换动画应保持流畅，无明显卡顿
- 隐藏视图不应有可见闪烁或布局抖动
- 首次加载时间不应显著增加（视图懒加载已在各组件内实现）

### General Checklist
- [ ] 所有 5 个视图的状态在切换后完整保留
- [ ] 不引入 React Router
- [ ] 不改变现有的 SideNav 导航逻辑
- [ ] 隐藏视图不会触发不必要的副作用
