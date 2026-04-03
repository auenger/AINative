# Tasks: feat-git-modal-compact
## Task Breakdown

### 1. 弹窗高度约束
- [x] 给弹窗容器添加 `max-h-[85vh]` 限制
- [x] 重构布局为 Header(shrink-0) + Content(flex-1 overflow-y-auto) + Footer(shrink-0)

### 2. 文件分组折叠
- [x] 添加折叠状态管理（staged/unstaged/untracked 各自独立）
- [x] 分组标题添加点击折叠/展开交互
- [x] 折叠态显示文件数量 badge
- [x] 添加折叠/展开过渡动画（AnimatePresence + motion.div）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-04 | Task 1 & 2 completed | max-h-[85vh] + scrollable content + 3-group collapsible sections with motion animations |
