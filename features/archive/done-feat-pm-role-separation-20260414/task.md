# Tasks: feat-pm-role-separation

## Task Breakdown

### 1. Prompt 重构
- [x] 重新设计 ProjectView PM Agent 的 system prompt，聚焦纯需求分析
- [x] 确保 New Task 内置 PM 的 PM_SYSTEM_PROMPT 与项目级 prompt 完全独立
- [x] 验证两套 prompt 的职责边界（项目级 vs feature 创建级）

### 2. ProjectView 功能调整
- [x] 移除 ProjectView 中 Generate Tasks / Create Feature 相关按钮
- [x] 清理 ProjectView 中 `generateFeaturePlan` 和 `createFeature` 调用
- [x] 调整 PM Agent greeting message，体现 "Requirement Analyst" 定位

### 3. 回归验证
- [x] 验证 New Task Modal 的 Built-in PM 路径仍正常工作
- [x] 验证 New Task Modal 的外部 Runtime 路径仍正常工作
- [x] 验证 ProjectView PM Agent 多轮对话无功能缺失

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-14 | Task 1 done | PM Agent prompt redesigned for pure requirement analysis role |
| 2026-04-14 | Task 2 done | Removed Generate Tasks button, Task Generation Modal, generateFeaturePlan/createFeature handlers; updated subtitle to "Requirement Analyst"; cleaned up unused imports (FeaturePlanOutput, Layers, Plus) |
| 2026-04-14 | Task 3 done | NewTaskModal is in a separate component file, untouched by this change; useAgentStream hook still exposes generateFeaturePlan/createFeature for other consumers |
