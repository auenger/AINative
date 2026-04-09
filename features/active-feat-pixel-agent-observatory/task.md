# Tasks: feat-pixel-agent-observatory

## Task Breakdown

### Phase 1: 基础设施 — 素材迁移与 Rust 后端

#### 1.1 素材迁移
- [ ] 创建 `neuro-syntax-ide/public/assets/pixel/` 目录结构
- [ ] 复制 `characters/` 精灵图目录（6 种角色）
- [ ] 复制 `furniture/` 家具目录（含 manifest.json）
- [ ] 复制 `floors/` 地板贴图
- [ ] 复制 `walls/` 墙壁贴图
- [ ] 复制 `default-layout.json` 默认布局
- [ ] 验证所有素材可正常加载

#### 1.2 Rust 后端 — JSONL 监控
- [ ] 新增 Tauri Command `watch_claude_jsonl(workspace_path)`
- [ ] 实现 JSONL 文件定位（workspace path → project hash → session 文件）
- [ ] 实现增量读取（记录上次读取行数，只读新增行）
- [ ] 实现 JSONL 行解析（tool_use, assistant, system 等事件提取）
- [ ] 实现 Agent 状态推断（typing/reading/command/idle/waiting）
- [ ] 通过 Tauri Event `pixel-agent://status` 推送状态变更
- [ ] 新增 Tauri Command `load_pixel_assets()` 返回素材路径映射

### Phase 2: 前端渲染引擎移植

#### 2.1 核心引擎移植
- [ ] 移植 `office/types.ts` — 类型定义（Character, OfficeLayout, TileType 等）
- [ ] 移植 `office/engine/characters.ts` — 角色状态机（idle→walk→type/read）
- [ ] 移植 `office/engine/officeState.ts` — 办公室状态管理（布局/座位/寻路）
- [ ] 移植 `office/engine/gameLoop.ts` — Canvas 2D 游戏循环
- [ ] 移植 `office/engine/renderer.ts` — 精灵图渲染器
- [ ] 移植 `office/engine/matrixEffect.ts` — spawn/despawn 特效
- [ ] 移植 `office/colorize.ts` — 色板系统

#### 2.2 布局系统移植
- [ ] 移植 `office/layout/tileMap.ts` — 地图系统
- [ ] 移植 `office/layout/furnitureCatalog.ts` — 家具目录
- [ ] 移植 `office/layout/layoutSerializer.ts` — 布局序列化
- [ ] 移植 `office/floorTiles.ts` — 地板渲染
- [ ] 移植 `office/wallTiles.ts` — 墙壁渲染

#### 2.3 精灵图系统移植
- [ ] 移植 `office/sprites/spriteCache.ts` — 精灵图缓存
- [ ] 移植 `office/sprites/spriteData.ts` — 精灵图数据
- [ ] 移植 `office/sprites/index.ts` — 导出
- [ ] 移植 `office/toolUtils.ts` — 工具工具函数

#### 2.4 Canvas 组件移植
- [ ] 移植 `office/components/OfficeCanvas.tsx` — Canvas 渲染组件
- [ ] 移植 `office/components/ToolOverlay.tsx` — 工具叠加层
- [ ] 移植 `ZoomControls.tsx` — 缩放控制
- [ ] 移植 `BottomToolbar.tsx` — 底部工具栏
- [ ] 移植 `constants.ts` — 常量定义

### Phase 3: Tab 集成

#### 3.1 Tauri 适配层
- [ ] 创建 `usePixelAgentStatus.ts` — 连接 Tauri Event + 更新 OfficeState
  - 替换 VS Code `postMessage/onMessage` 为 Tauri `listen`
  - 处理 `pixel-agent://status` 事件
  - 映射 Agent 状态到角色动画状态
- [ ] 移除所有 VS Code API 依赖（`vscodeApi.ts` → 删除/替换）

#### 3.2 Tab 注册
- [ ] `types.ts` 新增 ViewType: `'agent-pixel'`
- [ ] `SideNav.tsx` 新增导航项（Eye/Telescope 图标，label: "Observatory"）
- [ ] `App.tsx` 新增视图映射：`'agent-pixel' → <PixelAgentView />`
- [ ] i18n 新增翻译 key: `nav.observatory`

#### 3.3 PixelAgentView 入口组件
- [ ] 创建 `PixelAgentView.tsx` — Tab 入口
  - 管理 OfficeState 实例
  - 连接 usePixelAgentStatus hook
  - 挂载 OfficeCanvas
  - Tab 不可见时暂停 gameLoop
  - 显示 "No active agent" 空状态

### Phase 4: 联调与优化

#### 4.1 状态映射联调
- [ ] 验证 Rust JSONL 解析 → Tauri Event → React Hook → OfficeState 完整链路
- [ ] 验证各 Agent 状态对应的角色动画
- [ ] 验证 Agent 启动/停止时角色的 spawn/despawn

#### 4.2 性能优化
- [ ] Tab 不可见时暂停 Canvas 渲染循环
- [ ] Tab 切回时恢复渲染
- [ ] 长时间运行内存泄漏测试

#### 4.3 样式与体验
- [ ] 与现有 App 设计系统统一（背景色、边框等）
- [ ] 缩放控件样式适配
- [ ] 底部状态栏显示 Agent 当前操作文字

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-09 | Feature created | 初始 spec + task 定义 |
