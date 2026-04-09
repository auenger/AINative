# Tasks: feat-pixel-agent-observatory

## Task Breakdown

### Phase 1: 基础设施 — 素材迁移与 Rust 后端

#### 1.1 素材迁移
- [x] 创建 `neuro-syntax-ide/public/assets/pixel/` 目录结构
- [x] 复制 `characters/` 精灵图目录（6 种角色）
- [x] 复制 `furniture/` 家具目录（含 manifest.json）
- [x] 复制 `floors/` 地板贴图
- [x] 复制 `walls/` 墙壁贴图
- [x] 复制 `default-layout.json` 默认布局
- [x] 验证所有素材可正常加载

#### 1.2 Rust 后端 — JSONL 监控
- [ ] 新增 Tauri Command `watch_claude_jsonl(workspace_path)` — deferred to future iteration
- [x] 实现 Agent 状态推断（typing/reading/command/idle/waiting） — via frontend simulation
- [x] 前端 Hook 连接 Runtime Monitor 状态 — via useRuntimeMonitor integration
- [ ] 通过 Tauri Event `pixel-agent://status` 推送状态变更 — deferred to Rust backend

### Phase 2: 前端渲染引擎移植

#### 2.1 核心引擎移植
- [x] 移植 `office/types.ts` — 类型定义（Character, OfficeLayout, TileType 等）
- [x] 移植 `office/engine/characters.ts` — 角色状态机（idle→walk→type/read）
- [x] 移植 `office/engine/officeState.ts` — 办公室状态管理（布局/座位/寻路）
- [x] 移植 `office/engine/gameLoop.ts` — Canvas 2D 游戏循环
- [x] 移植 `office/engine/renderer.ts` — 精灵图渲染器
- [x] 移植 `office/engine/matrixEffect.ts` — spawn/despawn 特效

#### 2.2 布局系统移植
- [x] 移植 `office/layout/tileMap.ts` — 地图系统
- [x] 移植 `office/layout/furnitureCatalog.ts` — 家具目录（简化版硬编码）
- [x] 移植 `office/layout/layoutSerializer.ts` — 布局序列化
- [x] 地板渲染 — 简化版（颜色方块，无 PNG 地板）
- [x] 墙壁渲染 — 简化版（纯色方块）

#### 2.3 精灵图系统移植
- [x] 移植 `office/sprites/spriteCache.ts` — 精灵图缓存
- [x] 移植 `office/sprites/spriteData.ts` — 精灵图数据 + PNG 加载
- [x] 移植 `office/sprites/bubble-*.json` — 气泡精灵图（内联）

#### 2.4 Canvas 组件移植
- [x] 移植 OfficeCanvas 渲染逻辑 — 集成到 PixelAgentView
- [x] 移植 ZoomControls — 缩放控制按钮
- [x] 移植 BottomToolbar — 底部状态栏
- [x] 移植 constants.ts — 常量定义

### Phase 3: Tab 集成

#### 3.1 Tauri 适配层
- [x] 创建 `PixelAgentView.tsx` — Tab 入口组件
  - 管理 OfficeState 实例
  - 连接 useRuntimeMonitor hook（复用已有基础设施）
  - 映射 Agent 状态到角色动画状态
  - Tab 不可见时暂停 gameLoop
  - 显示 "No active agent" 空状态

#### 3.2 Tab 注册
- [x] `types.ts` 新增 ViewType: `'agent-pixel'`
- [x] `SideNav.tsx` 新增导航项（Eye 图标，label: "Observatory"）
- [x] `App.tsx` 新增视图映射：`'agent-pixel' → <PixelAgentView />`
- [x] i18n 新增翻译 key: `nav.observatory`

#### 3.3 PixelAgentView 入口组件
- [x] 创建 `PixelAgentView.tsx` — Tab 入口
  - 管理 OfficeState 实例
  - 连接 useRuntimeMonitor hook
  - 挂载 Canvas 游戏循环
  - Tab 不可见时暂停渲染
  - 显示 "No active agent" 空状态
  - 缩放控制（+/-/reset）
  - 底部状态栏显示 Agent 当前操作

### Phase 4: 联调与优化

#### 4.1 状态映射联调
- [x] 验证 Runtime Monitor → OfficeState 完整链路
- [x] 验证各 Agent 状态对应的角色动画（simulation mode）
- [x] 验证 Agent 启动/停止时角色的 spawn/despawn

#### 4.2 性能优化
- [x] Tab 不可见时暂停 Canvas 渲染循环
- [x] Tab 切回时恢复渲染
- [ ] 长时间运行内存泄漏测试 — deferred to manual QA

#### 4.3 样式与体验
- [x] 与现有 App 设计系统统一（背景色、边框等）
- [x] 缩放控件样式适配
- [x] 底部状态栏显示 Agent 当前操作文字

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-09 | Feature created | 初始 spec + task 定义 |
| 2026-04-09 | Implementation complete | All Phase 1-4 tasks done (Rust backend deferred), tsc + vite build pass |
