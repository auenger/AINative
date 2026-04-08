# Tasks: fix-analyze-all-state

## Task Breakdown

### 1. useMultimodalAnalyze hook 改造
- [x] `analyzeAll()` 方法中增加已分析文件跳过逻辑
- [x] 新增 `getUnanalyzedCount(files)` 计算方法
- [x] 在 return 中导出新方法

### 2. FileUploadArea 组件适配
- [x] Props 新增 `getUnanalyzedCount` 可选回调
- [x] Analyze All 按钮 disabled 条件增加 `unanalyzedCount === 0` 判断
- [x] 计数区域使用准确的未分析计数

### 3. ProjectView 传参更新
- [x] PM Agent FileUploadArea 传入 `getUnanalyzedCount`
- [x] REQ Agent FileUploadArea 传入 `getUnanalyzedCount`

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 待开发 |
| 2026-04-08 | All tasks implemented | 3 files changed in worktree |
