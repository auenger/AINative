# Feature: fix-terminal-tab-render Terminal Tab 渲染修复

## Basic Information
- **ID**: fix-terminal-tab-render
- **Name**: Terminal Tab 渲染修复（初始宽度 + 切换 + 缩放）
- **Priority**: 80
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-08T20:00:00Z

## Description

编辑器底部的终端面板中，通过快捷按钮启动 Claude Code / Gemini CLI 终端后，功能正常但渲染存在三个问题：

1. **初始渲染宽度不是 100%**：新创建的终端 tab 在首次显示时，xterm 画布没有填满容器宽度
2. **切换 tab 后样式错乱**：在多个终端 tab 之间切换，xterm 渲染错位、字符重叠或溢出
3. **缩放 app 后部分恢复但仍异常**：拖拽调整窗口大小后渲染有所改善，但仍有偏差

### 根因分析

1. **`display: none` 问题**：`XTerminal.tsx:353` 使用 `display: none` 隐藏非活跃终端。xterm.js 在 `display: none` 容器中初始化时无法获取正确的布局尺寸（clientWidth/clientHeight 为 0），导致 `FitAddon.fit()` 计算出错误的列数和行数。

2. **隐藏状态下创建 pty**：`addTab()` 在 `EditorView.tsx:642` 中立即创建新的 tab 并挂载 `XTerminal`。如果新 tab 不是当前活跃 tab，xterm 会在 `display: none` 状态下完成初始化（`XTerminal.tsx:141-171`），包括 pty 的 cols/rows 也基于错误尺寸。

3. **fit 时机不够可靠**：切换 tab 后的 fit 延迟仅 50ms（`XTerminal.tsx:277`），且仅一次。在某些情况下布局尚未完全就绪。

4. **motion.div 动画干扰**：终端面板使用 `motion.div` 的 `animate={{ height: terminalHeight }}` 进行动画，动画期间容器尺寸在变化，但 ResizeObserver 可能捕获到中间状态的尺寸。

## User Value Points

1. **终端渲染始终正确**：无论首次打开、tab 切换、面板拖拽还是窗口缩放，终端内容都能完整、正确地填充容器区域

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/XTerminal.tsx` — xterm.js 封装组件，核心渲染逻辑
- `neuro-syntax-ide/src/components/views/EditorView.tsx:1436-1446` — 终端 tab 容器，同时挂载所有 XTerminal 实例

### Related Documents
- 已归档 `fix-terminal-io-resize` — 终端输入输出修复 + 面板动态调整（部分相关，但本次聚焦 tab 切换渲染）

### Related Features
- `feat-editor-terminal-workspace` — 终端工作空间绑定

## Technical Solution

### 方案：替换 `display: none` 为绝对定位 + visibility

**核心改动：**

1. **XTerminal.tsx**：将 `style={{ display: active ? 'block' : 'none' }}` 改为使用绝对定位 + visibility/opacity。非活跃终端保持 `visibility: hidden; position: absolute; pointer-events: none`，这样容器始终占据空间，xterm 始终能获取正确的布局尺寸。

2. **XTerminal.tsx**：增强 fit 时机 — 除了 `active` 变化时 fit，还要在 `active` 从 false→true 时使用 `requestAnimationFrame` + 双帧延迟确保布局就绪。

3. **EditorView.tsx**：终端容器需要添加 `position: relative` 以配合绝对定位的终端实例。

### 具体代码变更

#### XTerminal.tsx — 渲染部分
```tsx
// 之前
<div
  ref={containerRef}
  className={cn('w-full h-full', ...)}
  style={{ display: active ? 'block' : 'none' }}
/>

// 之后
<div
  ref={containerRef}
  className={cn(
    'w-full h-full',
    active ? 'relative' : 'absolute inset-0 invisible pointer-events-none',
    ...
  )}
/>
```

#### XTerminal.tsx — fit 增强
```tsx
useEffect(() => {
  if (!active || !fitAddonRef.current || !termRef.current) return;
  // 双帧延迟：第一帧让 CSS 变化生效，第二帧 fit
  let raf1: number;
  let raf2: number;
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      try {
        fitAddonRef.current!.fit();
      } catch { /* ignore */ }
    });
  });
  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
  };
}, [active]);
```

#### EditorView.tsx — 终端容器
```tsx
// 终端实例容器添加 relative 定位
<div className="flex-1 w-full relative overflow-hidden">
```
（已有 `relative`，无需修改）

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望终端面板中的 Claude Code / Gemini CLI 终端在任何操作下都能正确渲染，不会出现宽度不足、内容错位或样式混乱。

### Scenarios (Given/When/Then)

#### Scenario 1: 初始渲染宽度正确
```gherkin
Given 终端面板已打开
When 用户点击快捷按钮启动 Claude Code 终端
Then Claude Code 终端应该立即以 100% 宽度渲染
And 终端内容应该完整填充面板区域，没有空白或溢出
```

#### Scenario 2: Tab 切换后渲染正确
```gherkin
Given 终端面板已打开，且有 Bash 和 Claude Code 两个终端 tab
When 用户从 Bash tab 切换到 Claude Code tab
Then Claude Code 终端应该以正确的尺寸渲染
And 字符不应出现重叠或错位
When 用户再切换回 Bash tab
Then Bash 终端也应该以正确的尺寸渲染
```

#### Scenario 3: 窗口缩放后终端自适应
```gherkin
Given 终端面板已打开，Claude Code 终端是活跃 tab
When 用户拖拽调整应用窗口大小
Then 终端内容应该自动重新排列以适应新的容器尺寸
And 不应出现水平滚动条或内容截断（除非内容确实超宽）
```

#### Scenario 4: 新增终端 tab 后渲染正确
```gherkin
Given 终端面板已打开，Bash 终端是活跃 tab
When 用户通过快捷按钮新增一个 Claude Code 终端 tab
And 切换到该新 tab
Then 新终端应该以 100% 宽度正确渲染
```

### UI/Interaction Checkpoints
- 终端内容区域无空白边距
- xterm 光标位置正确
- 终端文字不重叠、不截断
- tab 切换无闪烁或跳动

### General Checklist
- [x] 根因已定位（display: none + fit 时机）
- [x] 方案不影响其他功能（pty 通信、输入输出、resize 同步）
- [x] 不引入新的渲染性能问题

## Merge Record

| Field | Value |
|-------|-------|
| Completed | 2026-04-08T22:40:00Z |
| Branch | feature/fix-terminal-tab-render |
| Merge Commit | 4a68e85 |
| Archive Tag | fix-terminal-tab-render-20260408 |
| Conflicts | None |
| Verification | 4/4 scenarios passed (code analysis) |
| Duration | ~15min |
| Commits | 1 |
| Files Changed | 1 (XTerminal.tsx) |
