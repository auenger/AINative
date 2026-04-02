# Tasks: feat-detail-modal-interaction
## Task Breakdown

### 1. Rust 后端：修复 archive 目录搜索
- [x] 修改 `read_feature_detail` 函数，增加 `features/archive/done-{id}-*` 目录搜索
- [x] 保持原有搜索优先级：pending > active > 直接匹配 > archive
- [x] 测试：completed feature 点击后 MD 内容正确加载

### 2. 前端：弹窗拖拽功能
- [x] 在 `TaskBoard.tsx` 添加弹窗拖拽状态 (position: {x, y})
- [x] header 区域添加 `onMouseDown` 拖拽事件处理
- [x] `onMouseMove` / `onMouseUp` 全局事件监听
- [x] 拖拽时弹窗跟随鼠标移动，添加 cursor 视觉反馈
- [x] 关闭弹窗后重置位置到初始状态

### 3. 前端：弹窗调整大小功能
- [x] 弹窗容器添加 resize 支持 (CSS `resize: both` + `overflow: hidden`)
- [x] 设置 min-width (480px) / min-height (360px) 最小尺寸限制
- [x] 确保内容区域滚动正常 (body 使用 flex-1 + overflow-y-auto)

### 4. 集成测试
- [ ] 验证三种功能互不干扰
- [ ] 验证看板卡片拖拽不受弹窗拖拽影响
- [ ] 验证弹窗动画 (打开/关闭) 正常

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 初始分析完成，等待开发 |
| 2026-04-02 | All dev tasks done | Rust archive 搜索、拖拽、resize 均已实现，TypeScript + Rust 编译通过 |
