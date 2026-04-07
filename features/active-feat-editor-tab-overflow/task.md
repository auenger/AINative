# Tasks: feat-editor-tab-overflow

## Task Breakdown

### 1. Tab 溢出检测 Hook
- [x] 创建 `useTabOverflow` hook，使用 `useRef` + `ResizeObserver` 检测容器溢出状态
- [x] 提供 `canScrollLeft` / `canScrollRight` 状态
- [x] 提供 `scrollToTab(index)` 方法

### 2. 滚动导航箭头
- [x] 在 tab 容器左侧添加 ChevronLeft 按钮
- [x] 在 tab 容器右侧添加 ChevronRight 按钮
- [x] 溢出时才显示箭头，点击平滑滚动
- [x] 激活 tab 变更时自动 scrollIntoView

### 3. 溢出下拉菜单
- [x] 在 tab 栏右侧固定位置添加下拉触发按钮
- [x] 实现下拉面板组件，显示所有已打开文件
- [x] 每项显示：文件图标 + 文件名 + 修改标记 + 关闭按钮
- [x] 当前激活项高亮
- [x] 点击切换文件 + 自动关闭菜单

### 4. 样式与交互优化
- [x] 箭头按钮样式：与 tab 栏风格统一
- [x] 下拉菜单样式：使用 surface 层级，圆角，阴影
- [x] 过渡动画：箭头淡入淡出，下拉菜单展开收起
- [x] 键盘支持：下拉菜单上下箭头导航 + Enter 选择

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All 4 tasks complete | useTabOverflow hook, scroll arrows with AnimatePresence, overflow dropdown with keyboard nav (ArrowUp/Down/Enter/Escape). Uses existing design system (surface colors, cn(), motion/react). No new deps. |
