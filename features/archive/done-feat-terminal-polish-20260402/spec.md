# Feature: feat-terminal-polish 终端主题与显隐控制

## Basic Information
- **ID**: feat-terminal-polish
- **Name**: 终端主题与显隐控制
- **Priority**: 70
- **Size**: S
- **Dependencies**: [feat-view-state-persistence]
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description

编辑器页面内嵌终端存在两个问题：
1. 终端背景样式未跟随全局主题系统（明暗切换时终端背景色不变化）
2. 终端关闭后没有重新打开的控制入口

需要让终端正确响应 ThemeContext，并在终端收起/关闭时提供明确的 toggle 按钮。

## User Value Points

### VP2: 终端主题跟随
终端的背景色、文字色应随全局明暗主题自动切换，保持视觉一致性。

### VP3: 终端显示/隐藏控制
用户关闭终端后，应能在编辑器面板中找到明确的按钮/控件重新打开终端。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 终端区域渲染，terminalOpen 状态
- `neuro-syntax-ide/src/context/ThemeContext.tsx` — useTheme() hook，resolved 主题值
- `neuro-syntax-ide/src/components/XTerminal.tsx` — xterm.js 终端组件
- `neuro-syntax-ide/src/lib/monaco-theme.ts` — Monaco 主题定义（参考终端主题实现）

### Related Documents
- project-context.md — 设计系统颜色定义

### Related Features
- feat-native-terminal (已完成) — xterm.js 终端基础实现
- feat-app-theme-system (已完成) — 全局明暗主题系统
- feat-view-state-persistence (pending) — View 状态持久化（本 feature 依赖）

## Technical Solution

### 1. 终端主题跟随

在 EditorView 或 XTerminal 中使用 `useTheme()` 获取当前 `resolvedTheme`，动态设置 xterm.js 的 `theme` 选项。

```tsx
const { resolvedTheme } = useTheme();

// xterm.js theme 配置
const terminalTheme = useMemo(() => ({
  background: resolvedTheme === 'dark' ? '#0d1117' : '#ffffff',
  foreground: resolvedTheme === 'dark' ? '#e6edf3' : '#1f2328',
  cursor: resolvedTheme === 'dark' ? '#58a6ff' : '#0969da',
  // ... 其他颜色
}), [resolvedTheme]);
```

在 XTerminal 组件中通过 `terminal.options.theme` 动态更新。

### 2. 终端显隐 toggle 控件

在终端关闭时，在编辑器底部显示一个 floating button（参考 Console 的 icon toggle 模式），点击可重新打开终端。

```tsx
{!terminalOpen && (
  <button onClick={() => setTerminalOpen(true)}
    className="fixed bottom-XX right-XX ...">
    <Terminal size={16} />
  </button>
)}
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望终端视觉风格跟随全局主题，且关闭后可以方便地重新打开。

### Scenarios (Given/When/Then)

#### Scenario 1: 终端深色主题
```gherkin
Given 全局主题为 dark
When 用户打开 Editor 视图中的终端
Then 终端背景色为深色
And 终端文字色为浅色
And 终端与编辑器背景风格一致
```

#### Scenario 2: 终端主题切换
```gherkin
Given 终端处于打开状态
When 用户将全局主题从 dark 切换为 light
Then 终端背景色变为浅色
And 终端文字色变为深色
And 切换过程无闪烁
```

#### Scenario 3: 终端重新打开
```gherkin
Given 终端处于打开状态
When 用户点击终端关闭按钮
Then 终端面板收起
And 编辑器底部出现终端 toggle 按钮
When 用户点击 toggle 按钮
Then 终端面板重新展开
And 终端内容保持不变
```

#### Scenario 4: 终端在 tab 切换后保持
```gherkin
Given 终端处于打开状态且有 2 个终端标签
When 用户切换到其他 tab 再切回 Editor
Then 终端仍然是打开状态
And 2 个终端标签仍在
```

### UI/Interaction Checkpoints
- toggle 按钮应与 Console icon toggle 风格一致
- 终端主题切换应平滑过渡
- 终端收起/展开动画应保持现有 motion 动画

### General Checklist
- [x] 终端背景色跟随明暗主题
- [x] 终端关闭后有明确的重新打开入口
- [x] toggle 按钮风格与应用整体一致
- [x] 不影响终端现有功能（多标签、新建、切换）

## Merge Record
- **Completed**: 2026-04-02
- **Merged Branch**: feature/feat-terminal-polish
- **Merge Commit**: c2fa398
- **Archive Tag**: feat-terminal-polish-20260402
- **Conflicts**: None
- **Verification**: PASS (all 4 Gherkin scenarios verified, build passes)
- **Files Changed**: 1 (EditorView.tsx — +11 lines)
- **Duration**: ~30 minutes
