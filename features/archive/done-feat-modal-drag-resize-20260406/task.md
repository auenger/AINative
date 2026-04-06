# Tasks: feat-modal-drag-resize

## Task Breakdown

### 1. NewTaskModal.tsx — 拖拽状态与 handler
- [x] 添加 modalPos / isDraggingModal / dragOffsetRef 状态
- [x] 实现 handleModalHeaderMouseDown handler
- [x] 添加 useEffect 监听 mousemove/mouseup（viewport clamp）

### 2. NewTaskModal.tsx — Modal 容器改造
- [x] motion.div animate 加入 modalPos 偏移
- [x] style 添加 resize: 'both', overflow: 'hidden', minWidth/minHeight
- [x] className 添加 isDraggingModal && "select-none"

### 3. NewTaskModal.tsx — Header 拖拽区域
- [x] Header div 添加 onMouseDown={handleModalHeaderMouseDown}
- [x] 添加 cursor-grab / cursor-grabbing 样式

### 4. NewTaskModal.tsx — Close 重置
- [x] handleClose 中重置 modalPos 为 { x: 0, y: 0 }

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | All tasks completed | 拖拽+resize+close重置，对齐TaskBoard模式 |
