# Tasks: fix-settings-api-base-url

## Task Breakdown

### 1. 定位并确认根因
- [x] 在开发模式下复现 Bug：打开 Settings > LLM，尝试修改 API Base URL，观察值是否回退
- [x] 添加 console.log 或 React DevTools 确认 `load()` 是否在编辑期间被调用
- [x] 确认是 `load()` 重复调用还是其他原因导致的状态重置

### 2. 实施修复
- [x] 修改 `useSettings.ts`: 在 `load()` 中添加 dirty 状态保护，防止编辑中重置
- [x] 如果方案 1 不够，实施备选方案：LlmPanel 内使用本地 state + blur 同步
- [x] 确保 `useCallback` 依赖数组正确（特别是 `[dirty]`）

### 3. 验证修复
- [ ] 测试 ZAI 默认供应商的 API Base URL 修改
- [ ] 测试新增供应商的 API Base URL 修改
- [ ] 测试编辑中切换 Tab 再切回的场景
- [ ] 测试修改后 Save 持久化
- [ ] 测试 API Key 字段仍然正常工作
- [ ] 测试新增/删除供应商功能不受影响

## Progress Log

| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-14 | Feature 创建 | 完成 spec.md 和初始任务分解 |
| 2026-04-15 | 根因分析 | StrictMode double-fire + load() 无 dirty 保护导致状态覆盖 |
| 2026-04-15 | 实施修复 | 方案1: load() 添加 dirty guard + AbortController cleanup |
