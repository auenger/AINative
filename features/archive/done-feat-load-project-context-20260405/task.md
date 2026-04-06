# Tasks: feat-load-project-context

## Task Breakdown

### 1. 替换硬编码 projectContext 为动态加载
- [x] 移除 `useState` 中的硬编码字符串，改为 `useState<string | null>(null)`
- [x] 添加 loading / error 状态变量
- [x] 添加 `useEffect`：监听 `workspacePath` 变化，调用 `invoke('read_file')` 加载 `${workspacePath}/project-context.md`
- [x] 添加 `loadProjectContext` 回调函数供刷新按钮调用

### 2. 更新 PROJECT CONTEXT 渲染区域 UI
- [x] 加载中状态：显示 shimmer 骨架动画
- [x] 加载成功：保持现有 ReactMarkdown 渲染
- [x] 文件不存在（error 包含 "does not exist"）：显示空状态引导 UI
- [x] 其他错误：显示错误提示
- [x] 刷新按钮调用 `loadProjectContext`

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-05 | Feature created | 待开发 |
| 2026-04-05 | Implementation done | Task 1 & 2 完成：替换硬编码为动态加载 + UI 状态渲染 |
