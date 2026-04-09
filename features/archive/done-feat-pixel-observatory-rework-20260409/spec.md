# Feature: feat-pixel-observatory-rework

## Basic Information
- **ID**: feat-pixel-observatory-rework
- **Name**: Pixel Agent Observatory 100% 复刻（MIT Reference 直接移植）
- **Priority**: 80
- **Size**: L
- **Dependencies**: feat-pixel-agent-observatory (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-09

## Description
将 reference/pixel-agents/（MIT 协议）的 webview-ui/src/ 下的完整实现 100% 忠实移植到项目中，替换当前简化的实现。

当前 feat-pixel-agent-observatory 完成度差：引擎层被大幅裁剪、缺少完整 UI 组件、缺少编辑器系统、缺少地板/墙壁精灵系统。
本 feature 直接复刻 reference 代码，去除 VS Code 依赖，适配 Tauri IPC。

## User Value Points
1. **完整的像素办公室渲染** — 地板精灵着色、墙壁自动拼接、家具动画状态、Z-sorting 深度排序
2. **布局编辑器** — 完整的家具放置/旋转/删除、地板/墙壁绘制、网格扩展、撤销/重做
3. **Agent 完整交互** — 子代理支持、座位重分配、跟随相机、语音气泡、音效通知
4. **完整 UI 组件** — BottomToolbar、ZoomControls、SettingsModal、EditorToolbar、ToolOverlay

## Context Analysis
### Reference Code
- `reference/pixel-agents/webview-ui/src/` — 完整的 React + TypeScript webview（MIT）
- 核心引擎约 2500 行，UI 组件约 1500 行，编辑器约 800 行
- 使用 Canvas 2D 渲染，RequestAnimationFrame 游戏循环

### Related Documents
- `reference/pixel-agents/CLAUDE.md` — 完整架构文档

### Related Features
- feat-pixel-agent-observatory（已完成，本 feature 替代其实现）

## Technical Solution

### 策略：直接移植 reference 代码
1. 从 reference 复制 office/ 目录下所有模块
2. 去掉 VS Code 依赖（vscodeApi.ts），替换为 Tauri IPC 适配层
3. 去掉 `pixel` 前缀，恢复原始命名
4. 适配项目构建配置（Vite + TypeScript + Tailwind）

### 移植清单
**Phase 1 — 核心引擎补全**（从 reference 直接复制）
- `office/colorize.ts` — HSL 颜色系统
- `office/floorTiles.ts` — 地板精灵 + 着色缓存
- `office/wallTiles.ts` — 墙壁自动拼接
- `office/toolUtils.ts` — 工具映射
- 补全 `office/engine/renderer.ts`（缺编辑器/地板/墙壁渲染）
- 补全 `office/engine/officeState.ts`（缺子代理/座位管理）
- 补全 `office/sprites/spriteData.ts`（缺 hueShift、adjustSprite）

**Phase 2 — 编辑器系统**
- `office/editor/editorActions.ts`
- `office/editor/editorState.ts`
- `office/editor/EditorToolbar.tsx`

**Phase 3 — UI 组件**
- `components/BottomToolbar.tsx`
- `components/ZoomControls.tsx`
- `components/SettingsModal.tsx`
- `components/ToolOverlay.tsx`
- `office/components/OfficeCanvas.tsx`
- `notificationSound.ts`

**Phase 4 — 集成**
- 替换 `PixelAgentView.tsx` 为完整的组合根组件
- 创建 Tauri IPC 适配层（替代 vscodeApi.ts）
- 常量整合（constants.ts）

## Acceptance Criteria (Gherkin)
### Scenario 1: 完整渲染
Given 办公室已加载
When 用户打开 Observatory Tab
Then 应显示带地板精灵着色、墙壁自动拼接、家具动画的完整办公室

### Scenario 2: 布局编辑器
Given 用户点击 Layout 按钮
When 编辑器激活
Then 应显示网格覆盖、家具调色板、颜色选择器，支持放置/旋转/删除/撤销

### Scenario 3: Agent 交互
Given 有活跃 Agent
When 用户点击角色
Then 应显示白色选中轮廓、跟随相机、状态气泡

### Scenario 4: 子代理
Given Agent 使用 Task 工具
When 子代理创建
Then 应在父角色附近生成同色子角色，显示矩阵效果
