# Feature: feat-native-titlebar 恢复系统默认窗口标题栏

## Basic Information
- **ID**: feat-native-titlebar
- **Name**: 恢复系统默认窗口标题栏
- **Priority**: 80
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
当前应用使用 `decorations: false` 自定义无边框窗口方案，但关闭/最小化/最大化按钮不可用，窗口也无法拖动。恢复使用系统默认标题栏方案，确保窗口控制功能正常工作。

要求：
- macOS: 使用原生交通灯控件（红黄绿按钮），不需要冗余菜单栏
- Windows: 使用标准窗口标题栏和控件，不需要冗余菜单栏
- 后续会通过 Tauri 菜单 API 补充自定义菜单

## User Value Points
1. **窗口基础操作可用** - 用户可以正常关闭、最小化、最大化窗口
2. **窗口可拖动** - 用户可以通过标题栏拖动窗口位置

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/tauri.conf.json` - 窗口配置，当前 `decorations: false`
- `neuro-syntax-ide/src/components/TopNav.tsx` - 包含自定义 WindowControls 组件和 drag region
- `neuro-syntax-ide/src/App.tsx` - 主布局组件

### Related Documents
- project-context.md 中 Phase 1 记录的 "Borderless custom window + drag functionality" 已完成但不可用

### Related Features
- feat-tauri-v2-init (completed) - 初始化时设置了 `decorations: false`

## Technical Solution

### 方案：恢复系统原生装饰 + macOS 隐藏菜单栏

#### 1. tauri.conf.json 修改
- `decorations: false` → `decorations: true`（恢复系统默认标题栏）
- 删除 `transparent` 配置（不需要透明）

#### 2. macOS 隐藏默认菜单栏
在 `lib.rs` 中不创建任何 Menu，Tauri V2 默认不添加菜单栏。
如果 macOS 仍然显示默认菜单，可在 Tauri Builder 中设置空菜单。

#### 3. TopNav.tsx 修改
- 移除 `WindowControls` 组件（不再需要自定义按钮）
- 移除 `data-tauri-drag-region` 属性（系统标题栏自带拖拽）
- 移除 `Minus`, `Square`, `X` 图标导入
- TopNav 从标题栏角色变为纯导航栏角色
- 调整高度（无需与系统标题栏争空间）

#### 4. 布局调整
- macOS: 原生标题栏约 28px 高，TopNav 在标题栏下方作为导航栏
- Windows: 原生标题栏约 30px 高，同理
- App.tsx 整体布局无需大改，TopNav 高度可保持或微调

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望能够使用系统原生窗口控件来关闭、最小化、最大化窗口，并能通过标题栏拖动窗口。

### Scenarios

#### Scenario 1: 窗口控制按钮正常工作
```gherkin
Given 应用已启动
When 用户点击窗口的关闭按钮
Then 应用窗口关闭

Given 应用已启动
When 用户点击窗口的最小化按钮
Then 应用窗口最小化到任务栏/Dock

Given 应用已启动
When 用户点击窗口的最大化按钮
Then 应用窗口在全屏和窗口模式之间切换
```

#### Scenario 2: 窗口可通过标题栏拖动
```gherkin
Given 应用已启动
When 用户在标题栏区域按住鼠标左键并移动
Then 窗口跟随鼠标移动
```

#### Scenario 3: 无冗余菜单栏
```gherkin
Given 应用已启动
Then macOS 上不显示冗余的应用菜单栏（或仅显示最小化的应用名菜单）
And Windows 上不显示冗余的自定义菜单栏
```

#### Scenario 4: 导航栏功能正常
```gherkin
Given 应用已启动
Then TopNav 导航栏在系统标题栏下方正常显示
And 导航栏中的所有按钮（语言切换、AI、Deploy等）可正常点击
And 无残留的自定义窗口控制按钮
```

### UI/Interaction Checkpoints
- macOS: 红黄绿交通灯按钮正常显示在左上角
- Windows: 最小化/最大化/关闭按钮正常显示在右上角
- TopNav 导航栏显示在系统标题栏下方，无冲突
- 无残留的 `data-tauri-drag-region` 相关样式问题

### General Checklist
- [ ] 两种平台（macOS / Windows）均需验证
- [ ] 窗口尺寸、最小尺寸约束保持不变
- [ ] 不引入新的依赖
