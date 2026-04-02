# Tasks: feat-native-titlebar

## Task Breakdown

### 1. 修改 Tauri 窗口配置
- [x] 将 `tauri.conf.json` 中 `decorations: false` 改为 `decorations: true`
- [x] 移除 `transparent: false` 配置项（非必需）

### 2. 清理 TopNav 组件
- [x] 移除 `WindowControls` 组件定义及相关代码
- [x] 移除 `Minus`, `Square`, `X` 图标导入（来自 lucide-react）
- [x] 移除所有 `data-tauri-drag-region` 属性
- [x] 移除 `useEffect`, `useState` 导入（如果不再需要）
- [x] 调整 TopNav header 样式，确保与系统标题栏无冲突

### 3. 处理 macOS 菜单栏
- [x] 确认 Tauri V2 默认行为（无菜单栏）
- [x] 如需要，在 `lib.rs` 中配置不显示默认菜单（已确认无需修改，Tauri V2 默认不添加菜单）

### 4. 验证
- [ ] 在 macOS 上验证窗口控制按钮正常
- [ ] 验证窗口拖拽正常
- [ ] 验证 TopNav 导航功能不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 等待开发 |
| 2026-04-02 | Tasks 1-3 完成 | tauri.conf.json 已改 decorations:true；TopNav 已清理 WindowControls/drag-region/unused imports；lib.rs 无需修改 |
