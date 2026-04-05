# Feature: feat-agent-layout-optim Agent Tab 布局优化

## Basic Information
- **ID**: feat-agent-layout-optim
- **Name**: Agent Tab 配置表单 & 编排页面布局优化
- **Priority**: 70
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-05

## Description
优化调整 Agent Control Panel 中各 tab（Runtimes、Agents、Executions、Routes）的内容区域宽高占比，确保在全屏状态下所有配置表单和编排页面内容完整显示，消除显示不全的问题。

## User Value Points
1. **配置表单全屏适配** — Agent 配置表单（AgentCreator）、Pipeline 列表、Routing Rules 等表单内容在宽屏下完整显示，无截断
2. **编排页面（Pipeline Editor）完整可用** — 可视化编辑器的三栏布局和文本编辑器在全屏下正确填满可用空间
3. **Executions 详情面板高度正确** — 执行历史列表和详情面板撑满可用高度，无需硬编码 max-height

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Agent 控制面板主组件
  - 问题 1: 内容区域使用 `max-w-3xl` 限制宽度，在宽屏下浪费空间
  - 问题 2: Executions tab 使用硬编码 `maxHeight: calc(100vh - 160px)` 不准确
  - 问题 3: 主内容区 `overflow-y-auto scroll-hide p-6` 在 flex 容器中可能计算错误
- `neuro-syntax-ide/src/components/views/PipelineEditorContainer.tsx` — Pipeline 编辑器容器
- `neuro-syntax-ide/src/components/views/PipelineVisualEditor.tsx` — 可视化 Pipeline 编辑器
  - 三栏布局 w-56 / flex-1 / w-72，canvas 区域高度需正确继承

### Related Documents
### Related Features

## Technical Solution

### Changes Made
1. **Removed `max-w-3xl` from Runtimes, Agents, Routes tabs** -- replaced with `w-full` to use all available width
2. **Fixed Executions tab height** -- replaced hardcoded `style={{ maxHeight: 'calc(100vh - 160px)' }}` with `flex-1 min-h-0 flex gap-4` so the layout adapts to any viewport height
3. **Added `flex flex-col min-h-0` to scroll container** -- ensures the Executions tab's `flex-1` child properly fills available space within the `overflow-y-auto` parent
4. **PipelineVisualEditor three-column layout verified** -- the existing flex chain (flex-1 -> flex-1 -> w-56/flex-1/w-72) correctly propagates height from the main container through PipelineEditorContainer -> PipelineVisualEditor -> the three columns

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在 Agent Tab 中查看配置表单和编排页面时，所有内容在任意窗口尺寸下都能完整显示，不出现截断或溢出。

### Scenarios (Given/When/Then)

#### Scenario 1: Agent 配置表单全屏适配
```gherkin
Given 用户打开 Agent Control Panel
When 用户切换到 Agents tab
Then Agent 列表和配置表单应占满可用宽度（不使用 max-w-3xl 限制）
And 表单字段不应被截断
And 滚动仅在内容超出容器高度时出现
```

#### Scenario 2: Pipeline 编辑器全屏布局
```gherkin
Given 用户点击 "New Pipeline" 或编辑现有 Pipeline
When Pipeline 编辑器打开
Then 三栏布局（模板库 / Canvas / 属性面板）应正确填满可用空间
And Canvas 区域高度应继承父容器高度，无溢出
And 属性面板内容可滚动
```

#### Scenario 3: Executions 面板高度自适应
```gherkin
Given 用户切换到 Executions tab
When 执行列表有内容
Then 执行列表和详情面板应使用 flex 布局撑满高度
And 不应使用硬编码的 max-height style
And 列表过长时正确滚动
```

### UI/Interaction Checkpoints
- [ ] 全屏下 Agent 配置表单无截断
- [ ] Pipeline 可视化编辑器 Canvas 无溢出
- [ ] Executions 列表高度自适应
- [ ] Routes tab 表单和列表完整显示
- [ ] 窗口缩小时内容正确响应式调整

### General Checklist
- [ ] 不修改设计系统（颜色/字体/动画）
- [ ] 保持 cn() 样式合并模式
- [ ] 不引入新依赖

## Merge Record
- **Completed**: 2026-04-06
- **Merged Branch**: feature/feat-agent-layout-optim
- **Merge Commit**: eb9ae62
- **Archive Tag**: feat-agent-layout-optim-20260406
- **Conflicts**: None
- **Verification**: 3/3 scenarios passed
- **Stats**: 1 commit, 1 file changed, 5 insertions, 5 deletions
