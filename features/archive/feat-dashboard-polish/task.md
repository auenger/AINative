# Tasks: feat-dashboard-polish
## Task Breakdown

### 1. Tab 命名更新
- [ ] 修改 `i18n.ts` 中 `nav.missionControl` 中文翻译: "任务控制" -> "主控看板"
- [ ] 修改 `i18n.ts` 中 `missionControl.title` 中文翻译: "任务控制" -> "主控看板"

### 2. CPU 折线图修复
- [ ] 修复 Sparkline 组件 SVG 渲染:
  - 添加 `preserveAspectRatio="none"` 让折线拉伸填充容器
  - 给 SVG 添加 `w-full h-full` class 确保填满容器
  - 确保数据点映射正确（0-100 范围）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
