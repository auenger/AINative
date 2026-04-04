# Tasks: feat-editor-save-status

## Task Breakdown

### 1. 移除 Run 按钮
- [x] 删除 EditorView.tsx 中 Run 按钮 JSX（L836-840）
- [x] 清理 `Play` 图标 import（如无其他引用）

### 2. 增强 Save 按钮为状态指示器
- [x] 修改 Save 按钮：isDirty=false 时显示「已保存」状态（✓ + 灰色）
- [x] 修改 Save 按钮：isDirty=true 时显示「保存」状态（● + 醒目色 + 可点击）
- [x] 添加 `Check` 图标 import（lucide-react）

### 3. 验证 & 清理
- [x] 确认 Cmd/Ctrl+S 快捷键正常工作
- [x] 确认 Tab 红点与按钮状态同步
- [x] 确认多 Tab 切换时状态正确

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-06 | Feature created | 等待开发 |
| 2026-04-06 | Implementation complete | 移除 Run 按钮，Save 按钮改为状态指示器，添加 i18n 键 |
