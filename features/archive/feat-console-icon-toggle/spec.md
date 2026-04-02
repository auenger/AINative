# Feature: feat-console-icon-toggle Console 折叠态改为右侧小图标

## Basic Information
- **ID**: feat-console-icon-toggle
- **Name**: Console 折叠态改为右侧小图标
- **Priority**: 60
- **Size**: S
- **Dependencies**: feat-console-collapse-strip (已完成)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
Console 面板默认关闭，折叠后不显示全宽 28px 条，改为仅在右侧显示一个小图标按钮，点击可展开。减少折叠态视觉占用，同时提供明确的展开入口。

## User Value Points
1. **默认折叠** — 减少初始视觉噪音，给主内容区更多空间
2. **小图标入口** — 折叠时仅右侧保留一个小 icon，不占底部空间，点击图标即可展开 Console

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/BottomPanel.tsx` — 当前面板组件
- `neuro-syntax-ide/src/App.tsx:26` — `consoleVisible` 状态初始化为 `true`
- 前置 feature `feat-console-collapse-strip` 已实现 28px 全宽折叠条

### Related Documents
- project-context.md 布局框架中 BottomPanel 定义

### Related Features
- feat-console-collapse-strip (已完成归档) — 之前实现了 28px 折叠条

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Console 面板默认隐藏，仅在需要时通过一个小图标展开，以减少视觉干扰并获得更多工作空间。

### Scenarios (Given/When/Then)

#### Scenario 1: Console 默认关闭
```gherkin
Given 应用刚启动
When 用户看到主界面
Then Console 面板默认为关闭状态
And 底部不显示全宽折叠条
And 右下角显示一个小的 Terminal 图标按钮
```

#### Scenario 2: 通过小图标展开 Console
```gherkin
Given Console 面板处于关闭状态
And 右下角显示一个 Terminal 小图标
When 用户点击该图标
Then Console 面板平滑展开显示日志内容
```

#### Scenario 3: 关闭 Console 后回到图标态
```gherkin
Given Console 面板处于展开状态
When 用户点击面板头部关闭按钮 (X)
Then Console 面板平滑收起
And 右下角恢复显示 Terminal 小图标
```

### UI/Interaction Checkpoints
- [ ] 折叠态：仅右下角显示一个 ~28x28 的图标按钮（Terminal icon）
- [ ] 图标按钮有 hover 效果（颜色变化 / tooltip）
- [ ] 展开动画流畅（transition-all duration-300）
- [ ] 展开后图标消失，面板完整显示
- [ ] 关闭面板后图标重新出现

### General Checklist
- [ ] 不影响 StatusBar 的显示
- [ ] 不影响主内容区布局
- [ ] 图标在右侧，不影响左侧内容
