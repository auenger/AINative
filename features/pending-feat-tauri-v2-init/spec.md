# Feature: feat-tauri-v2-init Tauri V2 工程初始化

## Basic Information
- **ID**: feat-tauri-v2-init
- **Name**: Tauri V2 工程初始化
- **Priority**: 90
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-01

## Description

在 `neuro-syntax-ide/` 目录下搭建 Tauri V2 工程 (`src-tauri/`)，将现有的 React + Vite 原型应用包裹进桌面窗口。这是整个项目从 Web 原型走向桌面 App 的第一步。

核心目标：
1. `tauri dev` 能启动桌面窗口并渲染原型 React 页面
2. 无边框自定义窗口 + 拖拽栏 + 窗口控制按钮
3. 开发模式支持 Vite HMR 热更新

## User Value Points

### VP1: Tauri 脚手架 + Vite 集成
**用户价值**: 开发者运行 `tauri dev` 即可在原生桌面窗口中看到完整的 React 原型页面，且编辑代码后自动热更新。
**验收标准**: `cargo tauri dev` 启动后，窗口内显示原型全部 5 个视图且可正常切换。

### VP2: 无边框自定义窗口
**用户价值**: 应用呈现原生级窗口体验，无 OS 默认标题栏，顶部导航栏可拖拽移动窗口，带自定义最小化/最大化/关闭按钮。
**验收标准**: 窗口无系统标题栏，TopNav 可拖拽移动，三个控制按钮功能正常。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/App.tsx` — 主入口，视图路由
- `neuro-syntax-ide/src/components/TopNav.tsx` — 顶栏，需添加拖拽区域和窗口控制
- `neuro-syntax-ide/vite.config.ts` — Vite 配置，dev server 端口 3000
- `neuro-syntax-ide/package.json` — 依赖管理

### Related Documents
- `project-context.md` — Phase 1 路线图
- `module_1_core_workspace.md` — Tauri 基建模块方案
- `tauri_architecture_plan.md` — 全局架构方案

### Related Features
- 后续 Feature: 真实文件系统接入、YAML 数据绑定、终端集成等

## Technical Solution

### 工程结构
```
neuro-syntax-ide/
├── src-tauri/                    # [新建] Tauri V2 后端
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 窗口/权限/构建配置
│   ├── capabilities/
│   │   └── default.json          # 权限声明
│   ├── icons/                    # 应用图标
│   └── src/
│       ├── main.rs               # Tauri 入口 (Windows 主循环)
│       └── lib.rs                # Commands & 事件注册
├── src/                          # [已有] React 前端
├── package.json                  # [修改] 添加 @tauri-apps 依赖
└── vite.config.ts                # [已有] Vite 配置
```

### tauri.conf.json 关键配置
```json
{
  "app": {
    "windows": [{
      "title": "Neuro Syntax IDE",
      "width": 1400,
      "height": 900,
      "decorations": false,
      "transparent": false
    }],
    "security": {
      "csp": null
    }
  },
  "build": {
    "devUrl": "http://localhost:3000",
    "frontendDist": "../dist"
  }
}
```

### TopNav 改造
- 顶栏添加 `data-tauri-drag-region` 属性实现窗口拖拽
- 右侧添加最小化/最大化/关闭按钮
- 使用 `@tauri-apps/api/window` 的 `getCurrent()` 获取窗口实例

### 前端新增依赖
```json
{
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-opener": "^2"
}
```

### Rust 依赖 (Cargo.toml)
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Acceptance Criteria (Gherkin)

### VP1: Tauri 脚手架 + Vite 集成

```gherkin
Scenario: 首次启动 Tauri 桌面应用
  Given 已安装 Rust 工具链和 Node.js 依赖
  When 在 neuro-syntax-ide/ 目录下执行 "cargo tauri dev"
  Then 系统编译 Rust 后端并启动 Vite dev server
  And 打开一个桌面窗口显示 Neuro Syntax IDE 原型页面
  And 窗口尺寸为 1400x900

Scenario: Vite HMR 热更新
  Given Tauri 开发模式已启动
  When 修改 src/components/TopNav.tsx 中的任意文本
  Then 桌面窗口中的内容在 2 秒内自动更新
  And 无需手动刷新页面

Scenario: 切换视图正常工作
  Given Tauri 桌面应用已启动
  When 点击侧边导航栏的各个图标 (Project/Tasks/Editor/Mission/Workflow)
  Then 主内容区域切换到对应的视图组件
  And 视图切换动画流畅无卡顿
```

### VP2: 无边框自定义窗口

```gherkin
Scenario: 无边框窗口显示
  Given Tauri 桌面应用已启动
  Then 窗口没有操作系统默认标题栏
  And 顶部显示自定义 TopNav 组件作为替代

Scenario: 窗口拖拽移动
  Given Tauri 桌面应用已启动
  When 在 TopNav 空白区域按住鼠标左键拖动
  Then 桌面窗口跟随鼠标移动位置

Scenario: 窗口控制按钮
  Given Tauri 桌面应用已启动
  When 点击最小化按钮
  Then 窗口最小化到任务栏
  When 点击最大化按钮
  Then 窗口在最大化和原始尺寸间切换
  When 点击关闭按钮
  Then 应用完全退出
```

### UI/Interaction Checkpoints
- 窗口标题栏区域: 品牌标识 + 文件标签 + AI/部署按钮 + 窗口控制按钮
- 拖拽区域: TopNav 除按钮外的空白区域
- 窗口控制按钮: 位于 TopNav 最右侧，使用 lucide-react 图标 (Minus/Square/X)

### General Checklist
- [ ] `cargo tauri dev` 启动无报错
- [ ] `cargo tauri build` 构建成功
- [ ] 所有 5 个视图在桌面窗口中正常渲染
- [ ] 中英文语言切换正常
- [ ] 底部日志面板和状态栏正常显示
