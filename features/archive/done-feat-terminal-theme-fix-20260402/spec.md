# Feature: feat-terminal-theme-fix 编辑器终端主题一致性修复 & 显隐按钮位置优化

## Basic Information
- **ID**: feat-terminal-theme-fix
- **Name**: 编辑器终端主题一致性修复 & 显隐按钮位置优化
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-app-theme-system (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description

编辑器 Tab 内嵌终端存在两个视觉问题：

1. **终端区域部分颜色硬编码，未跟随主题切换** — 终端 tab 栏、快速连接区使用了 `text-blue-400` 等 Tailwind 硬编码色值，在深色/浅色主题切换时无法正确响应，导致约一半 UI 元素颜色与主题不一致。

2. **编辑器终端显隐按钮与主页面 Console 显隐按钮位置重叠** — 两者都位于右下角区域（EditorView 终端 toggle: `bottom-3 right-3`，BottomPanel Console toggle: `bottom-8 right-3`），在两个面板同时处于折叠态时视觉上难以分辨。

## User Value Points

### VP1: 终端颜色主题一致性
用户在深色/浅色主题之间切换时，编辑器终端所有 UI 元素（tab 栏、快速连接区、终端面板背景）都应正确跟随主题配色，无硬编码色值残留。

### VP2: 显隐按钮清晰可辨
编辑器终端的 toggle 按钮和主页面 Console 的 toggle 按钮应在视觉上有明确区分，不重叠、不混淆，用户能一眼识别各自的归属。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 终端区域渲染（L856-L973），含 tab 栏 + toggle 按钮
- `neuro-syntax-ide/src/components/XTerminal.tsx` — xterm.js 终端实例，含 DARK/LIGHT 主题定义（L69-L115）
- `neuro-syntax-ide/src/components/BottomPanel.tsx` — Console 面板 + toggle 按钮（L14-L23）
- `neuro-syntax-ide/src/index.css` — CSS 主题变量系统

### Related Documents
- Design System (index.css) — 定义了完整的 token 体系，终端应使用 `--t-*` 变量

### Related Features
- `feat-app-theme-system` (completed) — 全局明暗主题基础设施
- `feat-terminal-polish` (completed) — 终端主题跟随 & 显隐控制（上一轮修复）

## Technical Solution

### VP1: 修复硬编码颜色

在 `EditorView.tsx` 终端区域中，将以下硬编码色值替换为主题 token：

| 当前硬编码 | 替换为 | 位置 |
|-----------|--------|------|
| `text-blue-400` (Gemini tab) | `text-blue-400` 保持不变，但使用 CSS 变量 `text-[var(--t-blue-400)]` 或保留语义色 | tabActiveColor / tabIcon |
| `text-blue-400` (Gemini quick connect) | 同上 | L937 |
| `Sparkles size={12} className="text-blue-400"` | 使用主题变量 | L919 |
| `Bot size={12} className="text-blue-400"` | 使用主题变量 | L937 |

**方案**: index.css 中已定义 `--t-blue-400`（深色: `#a2c9ff`，浅色: `#0b57d0`），终端中的 Gemini 相关蓝色应使用 `text-[color:var(--t-blue-400)]` 替换 `text-blue-400`。这样 Gemini 品牌色在两个主题下都会自适应。

同理，BottomPanel 中 `text-slate-500`（L48）应替换为 `text-[color:var(--t-slate-500)]`。

### VP2: 显隐按钮位置优化

**推荐方案**: 将 Console toggle 按钮下沉贴近底部状态栏。

- BottomPanel toggle: `bottom-8` → `bottom-1` 或 `bottom-0`，并右移避免与终端 toggle 冲突
- 或者：Console 按钮移至 StatusBar 区域内，作为状态栏的一部分
- 或者：EditorView 终端 toggle 移至终端 tab 栏位置（作为小按钮嵌入）

**最终方案**: Console toggle 按钮从 `bottom-8 right-3` 改为 `bottom-1 right-3`，贴近 StatusBar；EditorView 终端 toggle 保持 `bottom-3 right-3` 不变。两者垂直间距拉大至约 2rem，视觉上完全分离。

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望编辑器终端的颜色完全跟随主题切换，且终端和 Console 的显隐按钮不会重叠混淆。

### Scenarios (Given/When/Then)

#### Scenario 1: 深色主题下终端颜色一致
```gherkin
Given 用户已切换到深色主题
And 编辑器 Tab 处于活跃状态
And 终端面板已展开
Then 终端 tab 栏所有标签文字颜色应为深色主题对应色值
And Gemini 标签蓝色应为 --t-blue-400 深色值 (#a2c9ff)
And 快速连接区 Gemini 按钮颜色应与 Gemini 标签一致
And 终端面板背景应为 --t-app-bg
```

#### Scenario 2: 浅色主题下终端颜色一致
```gherkin
Given 用户已切换到浅色主题
And 编辑器 Tab 处于活跃状态
And 终端面板已展开
Then Gemini 标签蓝色应为 --t-blue-400 浅色值 (#0b57d0)
And 所有终端 UI 元素使用主题 token 渲染
```

#### Scenario 3: 显隐按钮不重叠
```gherkin
Given 编辑器 Tab 处于活跃状态
And 终端面板已折叠
And Console 面板已折叠
Then 编辑器终端 toggle 按钮应出现在编辑区域右下角
And Console toggle 按钮应出现在贴近 StatusBar 的位置
And 两个按钮之间有明确垂直间距（>= 2rem）
And 用户可一眼区分两个按钮的归属
```

#### Scenario 4: 切换主题时终端实时更新
```gherkin
Given 终端面板已展开
When 用户从深色主题切换到浅色主题
Then 终端 tab 栏颜色应立即更新为浅色主题对应值
And 终端 xterm 实例背景色应更新为浅色主题值
```

### UI/Interaction Checkpoints
- [ ] 终端 tab 栏 Gemini 标签颜色在深/浅色主题下均正确
- [ ] 快速连接区按钮颜色在深/浅色主题下均正确
- [ ] Console toggle 按钮与终端 toggle 按钮视觉分离
- [ ] Console log 时间戳颜色 `text-slate-500` 使用主题变量

### General Checklist
- [ ] 无新增硬编码色值
- [ ] 所有颜色引用通过 CSS 变量或 Tailwind token

---

## Merge Record

- **Completed**: 2026-04-02
- **Merged Branch**: feature/feat-terminal-theme-fix
- **Merge Commit**: 4a386f7
- **Archive Tag**: feat-terminal-theme-fix-20260402
- **Conflicts**: None
- **Verification**: PASS (4/4 Gherkin scenarios, 7/7 tasks)
- **Files Changed**: 2 (EditorView.tsx, BottomPanel.tsx)
- **Duration**: ~30 minutes
