# Feature: feat-ui-cleanup UI 清理与布局优化

## Basic Information
- **ID**: feat-ui-cleanup
- **Name**: UI 清理与布局优化
- **Priority**: 70
- **Size**: M
- **Dependencies**: feat-native-titlebar
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Children**: []
- **Created**: 2026-04-02

## Description
对 IDE 主界面进行三项 UI 清理优化：移除 Header 中硬编码的 mock 文件名标签、修复 SideNav 遮挡 Header logo 的布局问题、将底部 Console 面板改为可折叠并添加右下角切换按钮。

## User Value Points

### VP1: 清爽的 Header（移除 Mock 文件标签）
当前 Header 中硬编码了 `Main.ts`、`System.py`、`Workflow.node` 三个 mock 文件标签，这些在真实 IDE 场景中无意义。移除后 Header 更加简洁，为后续真实文件标签预留空间。

### VP2: Logo 正确显示（修复布局遮挡）
SideNav 使用 `fixed left-0 top-0 z-50` 且宽度 `w-16`，而 TopNav 的 logo 区域从最左侧开始，导致 "NEURO SYNTAX" 文字被 SideNav 遮挡。需要调整 TopNav 的左内边距或 logo 起始位置，使其不被侧栏遮挡。

### VP3: 可折叠的 Console 面板
底部 Console 面板当前固定高度 `h-48` 不可关闭，占用宝贵的编辑区域。需要：
- 支持点击关闭按钮隐藏 Console 区域
- 在右下角（状态栏或内容区右下角）保留一个小图标按钮用于重新显示 Console
- Console 显示/隐藏带有平滑过渡动画

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/TopNav.tsx` — Header 组件，包含 mock 文件标签 (L75-79) 和 logo (L73)
- `neuro-syntax-ide/src/components/SideNav.tsx` — 侧栏组件，`fixed left-0 top-0 w-16 z-50 pt-14` (L32)
- `neuro-syntax-ide/src/components/BottomPanel.tsx` — 底部 Console 面板，固定 `h-48` (L12)
- `neuro-syntax-ide/src/App.tsx` — 主布局，控制 BottomPanel 的渲染位置 (L72)

### Related Documents
- project-context.md — 布局框架图

### Related Features
- feat-native-titlebar — 恢复系统默认标题栏，可能影响 Header 布局

## Technical Solution

### VP1: 移除 Mock 文件标签
在 `TopNav.tsx` 中删除 L75-79 的三个 mock 文件 tab `<div>` 元素，同时可以移除分隔线 `<div className="h-4 w-px bg-outline-variant/30"></div>`。

### VP2: 修复 Logo 位置
方案：TopNav 的 Header 添加 `pl-16`（与 SideNav 的 `w-16` 对齐），确保 logo 不被侧栏遮挡。同时调整 SideNav 的 `pt-14`（确保侧栏内容从 Header 下方开始）。

具体修改：
- TopNav: 在 header 元素上添加 `pl-16` 左内边距
- 或者调整 SideNav: 在侧栏顶部放一个小 logo icon，让 Header 的 logo 区域有足够空间

### VP3: Console 可折叠
1. 在 `App.tsx` 中添加 `consoleVisible` state
2. 将 state 和 toggle 函数传给 `BottomPanel`
3. `BottomPanel` 中 X 按钮触发关闭回调
4. 隐藏时 Console 区域高度为 0（带过渡动画）
5. 在主内容区右下角添加浮动按钮（`Terminal` icon），点击显示 Console
6. 使用 `max-h-48` + `overflow-hidden` + `transition-all` 实现平滑折叠

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我想要一个干净整洁的界面布局，没有多余的 mock 元素，logo 正确显示，并且可以自由切换 Console 面板的显示，以便最大化利用编辑空间。

### Scenarios (Given/When/Then)

#### Scenario 1: Header 无 Mock 文件标签
```gherkin
Given 用户打开了 IDE 应用
When 查看 Header 区域
Then 不应看到 "Main.ts"、"System.py"、"Workflow.node" 等硬编码文件标签
And Header 应只显示 logo、操作按钮和窗口控制
```

#### Scenario 2: Logo 完整可见
```gherkin
Given 用户打开了 IDE 应用
When 查看 Header 区域
Then "NEURO SYNTAX" logo 文字应完整可见，不被侧栏遮挡
And SideNav 图标应在 logo 左侧正常显示
```

#### Scenario 3: 关闭 Console 面板
```gherkin
Given Console 面板当前处于显示状态
When 用户点击 Console 面板标题栏的关闭按钮 (X)
Then Console 面板应平滑折叠消失
And 主内容区应扩展占满 Console 原有空间
And 右下角应出现一个小的 Terminal 图标按钮
```

#### Scenario 4: 重新打开 Console 面板
```gherkin
Given Console 面板已关闭
When 用户点击右下角的 Terminal 图标按钮
Then Console 面板应平滑展开显示
And 右下角的 Terminal 图标按钮应隐藏或变为收起功能
```

### UI/Interaction Checkpoints
- [ ] Console 面板折叠/展开有平滑 CSS transition
- [ ] 右下角浮动按钮不遮挡重要内容
- [ ] 切换视图时 Console 显示状态保持不变

### General Checklist
- [x] 不引入新的 mock 数据
- [x] 保持现有设计系统（颜色/字体）
- [x] 不影响窗口拖拽功能 (data-tauri-drag-region)

## Merge Record

- **Completed**: 2026-04-02T04:10:00Z
- **Merged Branch**: feature/ui-cleanup
- **Merge Commit**: 391fb8c
- **Archive Tag**: feat-ui-cleanup-20260402
- **Conflicts**: None
- **Verification**: All 4 Gherkin scenarios passed. Build passes. TypeScript passes.
- **Evidence**: features/archive/done-feat-ui-cleanup-20260402/evidence/verification-report.md
- **Stats**: 1 commit, 4 files changed, 34 insertions, 14 deletions, duration ~12min
