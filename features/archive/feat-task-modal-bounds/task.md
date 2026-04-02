# Tasks: feat-task-modal-bounds

## Task Breakdown

### 1. 垂直拖拽边界放宽 (VP1)
- [x] 修改 `TaskBoard.tsx` handleMouseMove 中 clampedY 的下界，允许负 Y 值（向上拖动）
- [x] 确保弹窗 header 不会完全拖出视口顶部（保留一定可视区域用于继续拖动）

### 2. 宽度上限放宽 (VP2)
- [x] 将 `max-w-4xl` 替换为动态宽度约束（app 宽度的 2/3）
- [x] 确保 minWidth: 480 不变，仅放宽 maxWidth

### 3. 归档目录匹配修复 (VP3)
- [x] 修改 `lib.rs` read_feature_detail 函数，在 archive 搜索中增加精确匹配 `{feature_id}` 目录的逻辑
- [x] 验证现有 `done-{id}-*` 模式匹配不受影响
- [x] 测试两种归档命名格式都能正确找到 MD 文件

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
