# Tasks: feat-pixel-observatory-rework

## Task Breakdown

### Phase 1 — 核心引擎补全
- [ ] 移植 `colorize.ts`（HSL 颜色系统：Colorize + Adjust 模式）
- [ ] 移植 `floorTiles.ts`（地板精灵存储 + 着色缓存）
- [ ] 移植 `wallTiles.ts`（墙壁自动拼接 16-bit bitmask）
- [ ] 移植 `toolUtils.ts`（STATUS_TO_TOOL 映射）
- [ ] 移植 `constants.ts`（集中常量定义，替换 pixelConstants.ts）
- [ ] 补全 `sprites/spriteData.ts`（hueShift、adjustSprite、完整 fallback 模板）
- [ ] 补全 `engine/renderer.ts`（renderFrame 完整版：地板精灵、墙壁、座位指示器、编辑器覆盖层）
- [ ] 补全 `engine/officeState.ts`（子代理管理、座位重分配、家具自动状态、walkToTile）
- [ ] 移植 `office/types.ts`（完整类型定义，替换 pixelTypes.ts）

### Phase 2 — 编辑器系统
- [ ] 移植 `editor/editorActions.ts`（布局操作：放置/移动/旋转/删除/展开）
- [ ] 移植 `editor/editorState.ts`（编辑器状态：工具/幽灵/选择/撤销/重做）
- [ ] 移植 `editor/EditorToolbar.tsx`（编辑器工具栏 React 组件）

### Phase 3 — UI 组件
- [ ] 移植 `components/BottomToolbar.tsx`
- [ ] 移植 `components/ZoomControls.tsx`
- [ ] 移植 `components/SettingsModal.tsx`
- [ ] 移植 `components/ToolOverlay.tsx`
- [ ] 移植 `office/components/OfficeCanvas.tsx`（完整 Canvas 组件）
- [ ] 移植 `notificationSound.ts`（Web Audio API 通知音效）

### Phase 4 — 集成
- [ ] 创建 Tauri IPC 适配层（替代 vscodeApi.ts / useExtensionMessages.ts）
- [ ] 重写 `PixelAgentView.tsx` 为完整组合根组件
- [ ] 删除旧 `pixel*` 前缀文件，迁移到新命名
- [ ] 更新 App.tsx / SideNav.tsx 集成
- [ ] 构建验证 + TypeScript 编译通过

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-09 | Feature created | 基于分析结果创建 |
