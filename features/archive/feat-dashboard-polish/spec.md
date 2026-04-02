# Feature: feat-dashboard-polish 主控看板改名 & CPU 折线图修复

## Basic Information
- **ID**: feat-dashboard-polish
- **Name**: 主控看板改名 & CPU 折线图修复
- **Priority**: 65
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: empty
- **Created**: 2026-04-02

## Description
Mission Control tab 的当前中文名"任务控制"不准确，实际功能是系统监控仪表盘，应改为"主控看板"。同时该 tab 页面中的 CPU 监控折线图渲染异常，出现两条折线"乱飘"的现象。

## User Value Points
1. **语义更清晰的 Tab 命名** — 侧栏标签从"任务控制"改为"主控看板"，准确反映仪表盘监控定位
2. **正确的 CPU 折线图渲染** — 修复 SVG Sparkline 组件的缩放和定位问题，消除"乱飘"现象

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/MissionControl.tsx` — 主控看板视图组件
  - Sparkline 组件 (line 36-45): SVG polyline 渲染
  - CPU sparkline 使用了 3 处: 小图(line 200)、System Overview(line 263)、Charts 区(line 439)
- `neuro-syntax-ide/src/i18n.ts` — 国际化翻译文件
  - `nav.missionControl` (line 108): 中文"任务控制"
  - `missionControl.title` (line 180): 中文"任务控制"
- `neuro-syntax-ide/src/components/SideNav.tsx` — 侧栏导航

### Root Cause Analysis (CPU 折线图乱飘)
1. Sparkline SVG 组件缺少 `preserveAspectRatio="none"` — 默认 `xMidYMid meet` 导致内容居中而非拉伸填充
2. SVG 没有设置 `w-full` 等尺寸 class，导致在容器中实际渲染尺寸不可控
3. 当数据点较少时（刚启动），`step = width / (data.length - 1)` 计算出的步长很大，仅有的几个点被拉伸到整个 viewBox 宽度，视觉上像"乱飘"
4. 多处同时渲染同一 cpuHistory 数据，视觉上产生干扰

### Related Documents
### Related Features

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望主控看板 tab 名称准确反映其功能，且 CPU 折线图能正确渲染不乱飘。

### Scenarios (Given/When/Then)

#### Scenario 1: Tab 命名更新
```gherkin
Given 应用已启动
When 用户查看侧栏导航
Then "任务控制"标签应显示为"主控看板"
And 页面标题也应显示为"主控看板"
```

#### Scenario 2: CPU 折线图正常渲染
```gherkin
Given 硬件监控已启动并有数据
When 用户查看主控看板页面的 CPU Trend 图表
Then 折线图应平滑填充整个图表区域
And 不应出现折线跳跃或"乱飘"现象
And 折线应从左(60s ago)到右(Now)连续显示
```

#### Scenario 3: 少量数据点时不异常
```gherkin
Given 硬件监控刚启动，仅有 2-3 个数据点
When 用户查看 CPU sparkline
Then 图表应正常渲染而不出现拉伸变形
```

### UI/Interaction Checkpoints (if frontend)
- 侧栏 tab tooltip 显示"主控看板"
- 主控看板页面 h1 标题显示"主控看板"
- CPU 折线图在 60s 范围内平滑渲染

### General Checklist
- [ ] i18n 中文翻译更新
- [ ] 页面标题翻译同步更新
- [ ] Sparkline SVG 组件修复
