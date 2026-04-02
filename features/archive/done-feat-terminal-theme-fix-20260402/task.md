# Tasks: feat-terminal-theme-fix

## Task Breakdown

### 1. EditorView.tsx — 替换硬编码颜色为主题 token
- [x] 将 Gemini tab 的 `text-blue-400` 替换为 `text-[color:var(--t-blue-400)]`
- [x] 将快速连接区 Gemini 按钮的 `text-blue-400` 替换为 `text-[color:var(--t-blue-400)]`
- [x] 将 Gemini 下拉菜单项 `text-blue-400` 替换为 `text-[color:var(--t-blue-400)]`
- [x] 确认 tabActiveColor 中 Gemini 的 border 颜色也使用主题变量

### 2. BottomPanel.tsx — 修复硬编码颜色 & 调整 toggle 位置
- [x] 将 log 时间戳 `text-slate-500` 替换为 `text-[color:var(--t-slate-500)]`
- [x] 将 Console toggle 按钮位置从 `bottom-8 right-3` 改为 `bottom-1 right-3`

### 3. 验证
- [x] 深色主题下所有终端 UI 颜色正确
- [x] 浅色主题下所有终端 UI 颜色正确
- [x] 两个 toggle 按钮视觉位置明确分离

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Created | Feature request created |
| 2026-04-02 | Implemented | All 3 tasks completed: EditorView hardcoded colors replaced with theme tokens, BottomPanel timestamp color + toggle position fixed |
