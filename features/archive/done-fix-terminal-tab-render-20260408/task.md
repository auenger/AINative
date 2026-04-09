# Tasks: fix-terminal-tab-render

## Task Breakdown

### 1. XTerminal.tsx — 替换 display:none 为绝对定位隐藏
- [x] 修改容器渲染：active 时 `relative`，inactive 时 `absolute inset-0 invisible pointer-events-none`
- [x] 确保 `visibility: hidden` 状态下容器仍占据正确的布局尺寸

### 2. XTerminal.tsx — 增强 fit 时机
- [x] 替换 active useEffect 中的 setTimeout(50ms) 为双帧 requestAnimationFrame
- [x] 确保 fit 只在 active=true 时执行

### 3. 验证测试
- [x] 新建 Claude Code tab → 检查初始渲染宽度
- [x] 多 tab 切换 → 检查每次切换后渲染正确
- [x] 拖拽调整窗口大小 → 检查终端自适应
- [x] 拖拽调整终端面板高度 → 检查终端自适应

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-08 | Feature created | 待开发 |
| 2026-04-08 | Implementation done | Task 1 & 2 完成：display:none → absolute+invisible，fit 增强 double-RAF |
