# Tasks: feat-task-board-updated-time

## Task Breakdown

### 1. 时间格式化工具函数
- [x] 在 TaskBoard.tsx 中创建 `formatUpdatedTime(date: Date): { relative: string, absolute: string }` 函数
- [x] 实现时间差计算逻辑（刚刚 / X分钟前 / 今天 / 昨天 / 日期）

### 2. UI 显示优化
- [x] 修改 TaskBoard.tsx 第 499-503 行，替换 `toLocaleTimeString()` 为新的格式化函数
- [x] 添加 hover title tooltip 显示完整绝对时间
- [x] 调整文案/样式确保视觉协调

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-04 | Feature created | 待开发 |
| 2026-04-04 | Implementation complete | formatUpdatedTime + UI 更新 |
