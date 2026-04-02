# Feature: feat-console-collapse-strip Console 折叠条优化

## Basic Information
- **ID**: feat-console-collapse-strip
- **Name**: Console 折叠条优化
- **Priority**: 65
- **Size**: S
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
App 页面底部的 Console 模块，隐藏时存在以下问题：
1. 保留的 Terminal icon 按钮被遮挡了一半，显示不完整
2. 上方内容区域的高度也有一部分被遮挡，疑似高度超出底部边界

**期望行为**：Console 隐藏时，不使用浮动按钮方案，而是保留底部一小条横条（strip），将 Terminal icon 显示在这个横条内部。这样既解决 icon 遮挡问题，也修复内容区域高度溢出问题。

## User Value Points
1. **折叠状态视觉完整性** — Console 折叠后显示为一个精致的底部横条，icon 完整可见，不与 StatusBar 或其他元素冲突
2. **布局高度正确性** — 内容区域不再因 Console 折叠/展开导致高度溢出或遮挡

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/BottomPanel.tsx` — Console 面板组件
- `neuro-syntax-ide/src/App.tsx` — 主布局，控制 consoleVisible 状态和浮动按钮

### Current Implementation Issues
- BottomPanel 隐藏: `max-h-0 border-t-0 overflow-hidden` → 完全折叠
- 浮动按钮: `absolute bottom-2 right-2 z-30` → 被 StatusBar 遮挡
- 内容区域: `flex-1 flex flex-col` → BottomPanel 折叠为 0 后布局可能有误

### Related Features
- feat-ui-cleanup (已完成) — 之前做过 UI 清理，包含 console 折叠功能

## Technical Solution

### Changes Made
1. **BottomPanel.tsx** — Replaced `max-h-0 border-t-0` collapse with `max-h-[28px]` collapsed strip containing a Terminal icon + "Console" label button. Added `onOpen` prop for re-expand callback. Used conditional rendering (`visible ? expanded : collapsed strip`) instead of hiding content via max-height alone.
2. **App.tsx** — Removed floating Terminal button (`absolute bottom-2 right-2 z-30`) and the unused `Terminal` import. Passed `onOpen` callback to BottomPanel.

### Layout Analysis
- StatusBar is `fixed bottom-0 h-6 z-50` — stays at screen bottom, out of normal flow
- BottomPanel sits inside the main content flex column; when collapsed to 28px it still participates in the flex layout correctly, preventing content overflow
- The collapsed strip at `max-h-[28px]` provides a click target fully visible above the StatusBar zone

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望 Console 隐藏后底部显示一个完整可见的小横条，让我能清楚地看到恢复按钮并正常点击。

### Scenarios (Given/When/Then)

**Scenario 1: Console 折叠显示横条**
```gherkin
Given Console 面板当前是展开状态
When 用户点击关闭按钮
Then Console 内容收起
And 底部显示一个高度约 28-32px 的横条
And 横条内包含 Terminal icon 按钮用于重新展开
And 横条不与 StatusBar 重叠
```

**Scenario 2: 从横条恢复 Console**
```gherkin
Given Console 处于折叠横条状态
When 用户点击横条上的 Terminal icon
Then Console 平滑展开恢复
And 横条消失，显示完整 Console 面板
```

**Scenario 3: 内容区域高度正确**
```gherkin
Given 任意视图（Project/Editor/Tasks/Workflow/Mission Control）
When Console 在展开和折叠状态间切换
Then 主内容区域高度自适应调整
And 内容不被遮挡，不出现滚动条异常
```

### UI/Interaction Checkpoints
- [ ] 折叠横条高度固定，不随内容变化
- [ ] 横条背景色与设计系统一致（surface-container-lowest 或类似）
- [ ] 过渡动画流畅（transition-all duration-300）
- [ ] hover 效果正常
- [ ] 横条与 StatusBar 之间无重叠/间隙

### General Checklist
- [ ] 移除 App.tsx 中的浮动按钮方案
- [ ] BottomPanel 组件内处理折叠横条状态
- [ ] 确保布局在不同视图中都正确
