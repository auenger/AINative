# Feature: feat-pixel-agent-observatory

## Basic Information
- **ID**: feat-pixel-agent-observatory
- **Name**: Pixel Agent 可观测 Tab — Claude Code Agent 像素小人实时可视化
- **Priority**: 65
- **Size**: L
- **Dependencies**: feat-claude-code-runtime-monitor (已完成)
- **Parent**: null
- **Children**: feat-pixel-agent-engine, feat-pixel-agent-tab
- **Created**: 2026-04-09

## Description

在 Neuro Syntax IDE 中新增一个 "Observatory" Tab，使用 Canvas 2D 渲染像素风格的办公室场景，其中包含一个或多个像素小人角色，实时反映当前运行的 Claude Code Agent 的状态和行为。

核心灵感来自 [pixel-agents](https://github.com/pablodelucca/pixel-agents)（MIT 协议），该项目作为 VS Code 扩展实现了类似功能。我们将核心渲染引擎移植到 Tauri + React 架构中，利用已有的 Runtime 监控基础设施。

## User Value Points

### VP1: Agent 实时状态可视化
用户切换到 Observatory Tab 后，可以看到一个像素小人在办公室场景中实时反映当前 Claude Code Agent 的行为状态。无需阅读日志或终端输出，一眼就能看出 Agent 在做什么。

### VP2: 像素办公室场景
一个精致的像素风格办公室场景，包含桌椅、电脑、植物等家具。Agent 处于活跃状态时，电脑屏幕会亮起；等待输入时，小人头顶出现气泡提示。

### VP3: 多 Agent 场景扩展
支持未来多个 Agent 同时运行时，每个 Agent 对应一个独立的像素角色，可以同屏展示。

## Context Analysis

### Reference Code
- **pixel-agents** (MIT): `reference/pixel-agents/` — 完整参考实现
  - `webview-ui/src/office/engine/` — 游戏引擎核心（officeState, characters, gameLoop, renderer, matrixEffect）
  - `webview-ui/src/office/components/OfficeCanvas.tsx` — Canvas 渲染组件
  - `webview-ui/src/office/layout/` — 布局系统（tileMap, furnitureCatalog, layoutSerializer）
  - `webview-ui/src/office/sprites/` — 精灵图缓存系统
  - `webview-ui/public/assets/` — 像素素材（characters, furniture, floors, walls）
  - `src/agentManager.ts` + `src/fileWatcher.ts` — JSONL 读取与状态推断

### Related Documents
- `project-context.md` — 项目架构文档
- `CLAUDE.md` — 技术栈约束（React 19 + Tauri V2）

### Related Features
- `feat-claude-code-runtime-monitor` (已完成) — Claude Code 进程检测
- `feat-runtime-session-output` (已完成) — Runtime Session 输出持久化
- `feat-runtime-process-stop` (已完成) — 进程 Stop 按钮

### Tech Stack Compatibility
| pixel-agents | Neuro Syntax IDE | 适配方案 |
|---|---|---|
| React 19 + TypeScript | React 19 + TypeScript | 直接复用 |
| Canvas 2D 渲染 | Tauri WebView | 直接复用 |
| VS Code Webview messaging | Tauri Event + invoke | 需适配 |
| Node.js JSONL 文件轮询 | Rust 后端读取 JSONL | 更优方案 |
| esbuild | Vite 6 | 无影响 |

## Technical Solution

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Observatory View (React)          │
│  ┌──────────────────────────────────────┐   │
│  │  PixelAgentView.tsx (Tab Component)  │   │
│  │  ┌────────────────────────────────┐  │   │
│  │  │  OfficeCanvas.tsx (Canvas 2D)  │  │   │
│  │  │  - gameLoop (60fps)            │  │   │
│  │  │  - OfficeState (角色/寻路)      │  │   │
│  │  │  - renderer (精灵图渲染)        │  │   │
│  │  └────────────────────────────────┘  │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  usePixelAgentStatus.ts (Hook)              │
│  ↕ Tauri Events                            │
├─────────────────────────────────────────────┤
│           Tauri Rust Backend                │
│  watch_claude_jsonl() → 解析 JSONL          │
│  → emit("pixel-agent://status")            │
│                                             │
│  ~/.claude/projects/*/sessions/*.jsonl      │
└─────────────────────────────────────────────┘
```

### Data Flow

1. **Rust 后端**: 监控 `~/.claude/projects/{project_hash}/` 目录下的 JSONL session 文件
2. **JSONL 解析**: 读取每行 JSON，提取 tool_use、assistant、system 等事件类型
3. **状态推断**: 根据 JSONL 内容推断 Agent 状态（typing/reading/command/idle/waiting）
4. **事件推送**: 通过 Tauri Event `pixel-agent://status` 推送到前端
5. **Canvas 渲染**: OfficeState 更新角色状态 → gameLoop 每帧渲染

### Agent Status Mapping (JSONL → 角色状态)

| JSONL Event | Agent Status | 角色动画 |
|---|---|---|
| `assistant` message | `typing` | 坐在椅子上打字 |
| `tool_use` (Read/Grep/Glob) | `reading` | 坐着看屏幕（身体微前倾） |
| `tool_use` (Write/Edit) | `writing` | 坐着打字（更快） |
| `tool_use` (Bash) | `command` | 站起来走向终端 |
| `tool_result` | `processing` | 思考动画 |
| 等待用户输入 (permission) | `waiting` | 头顶气泡 "..." |
| 无事件 > 30s | `idle` | 靠椅背、偶尔伸懒腰 |
| Session 结束 | `offline` | 角色消失（despawn 动画） |

### Key Files to Port (from pixel-agents)

**直接移植（~90% 复用）**:
- `office/engine/officeState.ts` → 角色管理 + 寻路 + 座位
- `office/engine/characters.ts` → 角色状态机 + 动画帧
- `office/engine/gameLoop.ts` → Canvas 2D 游戏循环
- `office/engine/renderer.ts` → 精灵图渲染器
- `office/engine/matrixEffect.ts` → spawn/despawn 特效
- `office/layout/` → 地图系统（tileMap, furnitureCatalog, layoutSerializer）
- `office/sprites/` → 精灵图缓存
- `office/types.ts` → 类型定义
- `office/colorize.ts` → 色板系统

**需适配**:
- `hooks/useExtensionMessages.ts` → 替换 VS Code messaging 为 Tauri Event
- `vscodeApi.ts` → 替换为 Tauri invoke/listen API
- `App.tsx` → 简化为 Tab 组件

**新增**:
- `usePixelAgentStatus.ts` — 连接 Tauri 事件 + 更新 OfficeState
- `PixelAgentView.tsx` — Tab 入口组件
- Rust Command: `watch_claude_jsonl` — JSONL 文件监控
- Rust Command: `load_pixel_assets` — 加载像素素材

### Assets Migration

从 `reference/pixel-agents/webview-ui/public/assets/` 复制到 `neuro-syntax-ide/public/assets/pixel/`:
- `characters/` — 6 种角色精灵图（每种 4 方向 × 多帧动画）
- `furniture/` — 家具精灵图 + manifest.json
- `floors/` — 地板贴图
- `walls/` — 墙壁贴图
- `default-layout.json` — 默认办公室布局

## Acceptance Criteria (Gherkin)

### User Story
作为一个 Neuro Syntax IDE 用户，我想要一个可视化的像素小人 Tab，让我能直观地看到当前 Claude Code Agent 在做什么，而不用盯着终端输出。

### Scenarios

#### Scenario 1: 切换到 Observatory Tab 看到像素办公室
```gherkin
Given App 已启动且工作区已加载
When 用户点击 SideNav 的 "Observatory" 图标
Then 应显示一个像素风格的办公室场景
And 场景包含地板、墙壁、桌椅等家具
And 场景居中显示，支持缩放控制
```

#### Scenario 2: Agent 正在写代码时角色动画
```gherkin
Given 一个 Claude Code 进程正在运行
And Agent 正在执行 Write/Edit 工具
When 用户切换到 Observatory Tab
Then 像素小人应坐在桌前显示打字动画
And 对应的电脑屏幕应亮起
And 角色头顶可能显示工具名称气泡
```

#### Scenario 3: Agent 等待用户输入时气泡提示
```gherkin
Given Claude Code Agent 正在等待用户确认权限
When 用户查看 Observatory Tab
Then 像素小人头顶应显示 "!" 或 "?" 气泡
And 气泡应有脉冲动画以吸引注意
```

#### Scenario 4: Agent 空闲时角色休息
```gherkin
Given Claude Code 进程运行中但最近 30 秒无活动
When 用户查看 Observatory Tab
Then 角色应显示 idle 状态（靠椅背或偶尔伸懒腰）
And 电脑屏幕应关闭/变暗
```

#### Scenario 5: 无 Agent 运行时空场景
```gherkin
Given 当前没有 Claude Code 进程运行
When 用户切换到 Observatory Tab
Then 应显示空办公室场景
And 显示提示信息 "No active agent"
```

#### Scenario 6: Agent 进程启动时角色出现
```gherkin
Given Observatory Tab 已打开
And 办公室场景为空
When Claude Code 进程启动
Then 一个新的像素小人应以 spawn 特效出现在空座位上
And 角色应立即开始 idle 动画
```

### UI/Interaction Checkpoints
- [ ] SideNav 新增 "Observatory" 图标（Eye/Telescope 图标）
- [ ] Tab 内容为 Canvas 元素，全宽全高渲染
- [ ] 右下角缩放控制按钮（+/-/reset）
- [ ] 底部工具栏显示 Agent 状态文字（"Agent is typing..." / "Agent is reading..."）
- [ ] 点击角色可选中（高亮边框）
- [ ] Tab 不可见时暂停渲染循环（性能优化）

### General Checklist
- [ ] MIT 协议合规 — pixel-agents 代码和素材均以 MIT 发布
- [ ] 所有移植代码在文件头保留原始版权声明
- [ ] 无外部运行时依赖新增（仅 Canvas 2D API）
- [ ] Tab 切换时正确暂停/恢复渲染循环
- [ ] 内存泄漏测试 — 长时间运行无内存增长

## Merge Record

- **Completed**: 2026-04-09T16:30:00Z
- **Merged Branch**: feature/feat-pixel-agent-observatory
- **Merge Commit**: 2487d64
- **Archive Tag**: feat-pixel-agent-observatory-20260409
- **Conflicts**: None
- **Verification**: PASS (36/40 tasks, 6/6 Gherkin scenarios via code analysis, 4 deferred by design)
- **Stats**: ~90min duration, 3 commits, 18 files changed (14 new + 4 modified)
