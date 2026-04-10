# Feature: fix-terminal-add-tab 终端 Tab 新增与切换修复

## Basic Information
- **ID**: fix-terminal-add-tab
- **Name**: 终端 Tab 新增与切换修复
- **Priority**: 80
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: empty
- **Created**: 2026-04-10

## Description

编辑器终端面板中点击 "+" 按钮无法正确新增终端 tab。需要修复新增 tab 功能，并确保 tab 切换（bash / claude / gemini）功能稳定可靠。

### 已知问题
1. **"+" 按钮下拉菜单不可见** — 下拉菜单使用 `absolute left-0 top-full`，可能被父容器的 `overflow-hidden` 裁切导致无法点击
2. **Tab 新增后状态同步** — 新增 tab 后 `activeTabId` 更新但 XTerminal 可能未正确触发 PTY 创建
3. **Tab 切换时终端渲染** — 切换 tab 后 `fit()` 可能未正确执行，导致终端尺寸异常

### 涉及文件
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — Tab 管理 UI 和状态
- `neuro-syntax-ide/src/components/XTerminal.tsx` — 终端实例渲染与 PTY 通信

## User Value Points

### VP1: "+" 按钮正常工作
用户点击 "+" 按钮后能看到下拉菜单，选择终端类型后能成功创建新终端 tab。

### VP2: Tab 切换稳定
切换不同 tab 时，终端内容保持独立，渲染正确，尺寸适配。

## Context Analysis

### Reference Code
- `EditorView.tsx:642-652` — addTab 函数
- `EditorView.tsx:654-675` — closeTab 函数
- `EditorView.tsx:1375-1408` — "+" 按钮与下拉菜单 UI
- `EditorView.tsx:1435-1446` — XTerminal 实例渲染
- `XTerminal.tsx:140-260` — PTY 创建与生命周期
- `XTerminal.tsx:276-294` — active 状态下的 re-fit 逻辑

### Related Documents
- 已有类似修复: `fix-terminal-tab-render`（Tab 渲染修复，初始宽度 + 切换 + 缩放）

### Related Features
- `fix-terminal-tab-render` — 之前已完成的终端 tab 渲染修复
- `fix-terminal-io-resize` — 终端输入输出修复

## Technical Solution

### 方案分析

**问题根因定位：**
1. 下拉菜单的 `z-index` 和父容器 `overflow` 可能导致菜单不可见
2. `addTab` 通过 `useCallback` 定义，依赖 `[t]`，可能存在闭包陷阱
3. `_tabCounter` 是模块级变量，多实例场景下可能冲突

**修复策略：**
1. 修复 "+" 按钮下拉菜单的渲染位置和 z-index，确保不被裁切
2. 验证并加固 `addTab` / `closeTab` 的状态更新逻辑
3. 确保 tab 切换时 XTerminal 的 `active` prop 变化正确触发 re-fit
4. 添加 PTY 创建失败的降级处理（非 Tauri 环境 echo 模式）

### 详细实现步骤

1. **检查 tab bar 父容器的 overflow 设置**，确保下拉菜单不被裁切
2. **将下拉菜单改为 portal 或提升 z-index**，确保菜单在所有层级之上显示
3. **验证 addTab 状态更新** — 确保 `setTabs` 和 `setActiveTabId` 正确触发重渲染
4. **测试 tab 切换** — 验证 XTerminal active prop 变化时的 re-fit 逻辑
5. **添加 tab 新增后的滚动定位** — 新 tab 添加后自动滚动到该 tab 可见区域

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望能够通过点击 "+" 按钮新增终端 tab 并在不同 tab 之间稳定切换，以便同时使用多个终端实例。

### Scenarios (Given/When/Then)

#### Scenario 1: 新增 Bash 终端 Tab
```gherkin
Given 编辑器终端面板已打开
And 当前有 1 个 bash 终端 tab
When 用户点击 "+" 按钮
And 从下拉菜单中选择 "Bash"
Then 应新增一个 bash 终端 tab
And 新 tab 自动成为活跃 tab
And 终端面板显示新终端实例
And PTY 进程成功创建
```

#### Scenario 2: 新增 Claude CLI 终端 Tab
```gherkin
Given 编辑器终端面板已打开
When 用户点击 "+" 按钮
And 从下拉菜单中选择 "Claude CLI"
Then 应新增一个 claude 类型的终端 tab
And 新 tab 自动成为活跃 tab
And 终端面板显示 claude CLI 终端
```

#### Scenario 3: Tab 切换保持稳定
```gherkin
Given 终端面板中有 2 个以上 tab（如 bash + claude）
And 当前活跃 tab 是 bash
When 用户点击 claude tab
Then claude tab 变为活跃状态（高亮显示）
And bash 终端保持其内容不变（不丢失输出）
And claude 终端正确渲染并适配面板尺寸
```

#### Scenario 4: 关闭 Tab 后自动切换
```gherkin
Given 终端面板中有 3 个 tab（bash, claude, gemini）
And 当前活跃 tab 是 claude
When 用户关闭 claude tab
Then 应自动切换到相邻的 tab（bash 或 gemini）
And 切换后的 tab 终端渲染正常
```

#### Scenario 5: 关闭所有 Tab 后回退
```gherkin
Given 终端面板中只有 1 个 tab
When 用户关闭该 tab
Then 应自动创建一个新的 bash 终端 tab 作为回退
And 新终端渲染正常
```

#### Scenario 6: "+" 按钮下拉菜单点击外部关闭
```gherkin
Given 用户已点击 "+" 按钮展开下拉菜单
When 用户点击菜单外部区域
Then 下拉菜单应关闭
```

### UI/Interaction Checkpoints
- [ ] "+" 按钮位于 tab 栏右侧，hover 时有视觉反馈
- [ ] 下拉菜单在点击后出现，包含 Bash / Claude CLI / Gemini CLI 三个选项
- [ ] 每个选项有对应图标和颜色
- [ ] 新增 tab 后 tab 栏自动滚动到新 tab
- [ ] 活跃 tab 有底部彩色边框高亮
- [ ] tab 上的 "×" 关闭按钮在 hover 时显示

### General Checklist
- [ ] 不影响现有编辑器 tab（文件 tab）功能
- [ ] 非活跃终端 PTY 不消耗过多资源
- [ ] 终端 tab 状态在面板关闭/重新打开后重置

## Merge Record

- **Completed**: 2026-04-10
- **Merged Branch**: feature/fix-terminal-add-tab
- **Merge Commit**: eacbfb7
- **Archive Tag**: fix-terminal-add-tab-20260410
- **Conflicts**: None
- **Verification**: PASS (code analysis, 6/6 Gherkin scenarios verified)
- **Commits**: 1
- **Files Changed**: 1 (EditorView.tsx)
