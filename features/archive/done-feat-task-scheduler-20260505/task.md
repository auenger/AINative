# Tasks: feat-task-scheduler

## Task Breakdown

### 1. 类型定义
- [x] 在 `types.ts` 中添加 `TaskSchedule` 接口
- [x] 添加 `ScheduleAction` 和 `ScheduleStatus` 类型

### 2. 调度状态管理 Hook
- [x] 创建 `useTaskScheduler.ts` hook
- [x] 实现 schedules CRUD（create / read / update / delete）
- [x] 实现 localStorage 持久化
- [x] 实现后台轮询检查（setInterval 30s）
- [x] 实现触发逻辑（判断 triggerAt <= now → 更新状态 → 调用 skill）
- [x] 实现 missed 检测（App 启动时检查过期的 pending 调度）

### 3. UI — 卡片时钟按钮
- [x] TaskBoard Feature 卡片添加 Clock 图标按钮
- [x] hover tooltip "设置定时触发"
- [x] 已调度卡片的 badge 渲染（倒计时 / 已触发 / 已错过）

### 4. UI — 定时设置弹窗
- [x] 创建 `SchedulePickerModal.tsx` 组件
- [x] DateTime 时间选择器（日期 + 时间）
- [x] 动作选择：run-feature（指定当前 feature）/ dev-agent（全部 pending）
- [x] 过去时间校验 + 禁用确认按钮
- [x] glass-panel 样式，跟随项目设计系统

### 5. UI — 调度状态反馈
- [x] Task Board 顶部调度统计提示
- [x] 触发后 BottomPanel 日志输出（via console.log for non-Tauri, Tauri invoke for production）
- [x] missed 调度的 "立即执行" / "删除" 操作

### 6. 集成测试
- [ ] 设置 → 等待触发 → 验证状态变更
- [ ] 取消调度 → 验证状态更新
- [ ] App 重启后调度数据持久化验证

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-30 | Feature created | 需求收集完成，spec + task 文档生成 |
| 2026-05-05 | Implementation complete | Tasks 1-5 completed: types, hook, UI components, i18n integration |
