# Feature: feat-dark-theme-polish 深色主题边框配色优化 & Monaco 编辑器主题跟随

## Basic Information
- **ID**: feat-dark-theme-polish
- **Name**: 深色主题边框配色优化 & Monaco 编辑器主题跟随
- **Priority**: 65
- **Size**: M
- **Dependencies**: feat-app-theme-system (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description

深色主题下存在两个视觉问题：

1. **外边框/分割线偏蓝色** — 当前深色主题的 `--t-outline-variant` (`#414752`)、`--t-glass-border` (`rgba(162,201,255,0.1)`)、`--t-surface-container-high` (`#262a31`) 等色值带有明显蓝色偏移，用户反馈"深蓝有点难看了"，希望改为更中性的灰黑色调。

2. **Monaco 编辑器底色在深色主题下仍为白色** — 编辑器区域的 Monaco 实例在切换到深色主题后背景不变黑。根因是 `@monaco-editor/react` 的 theme 放在 `options` 对象内，不会在运行时响应式更新。需要在 `Editor` 组件上直接传 `theme` prop，或通过 `useEffect` 调用 `monaco.editor.setTheme()`。

## User Value Points

### VP1: 深色主题边框配色灰黑中性化
所有分割线、边框、面板分隔线在深色主题下使用中性灰黑色调，无蓝色偏移，视觉更干净。

### VP2: Monaco 编辑器跟随深色主题
编辑器背景、行号、代码高亮在切换主题时实时变化，深色主题下底色为深色。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/index.css` — CSS 主题变量定义（深色主题变量在 L70-L119）
- `neuro-syntax-ide/src/lib/monaco-theme.ts` — Monaco 深色/浅色主题定义（L13-L134 dark, L140-L261 light）
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — Monaco Editor 集成（L820-L847 Editor 组件，L560-L589 editorOptions）
- `neuro-syntax-ide/src/context/ThemeContext.tsx` — 主题切换上下文

### Root Cause Analysis

**VP1 边框偏蓝：**
| 变量 | 当前值 | 蓝色偏移 |
|------|--------|---------|
| `--t-outline-variant` | `#414752` | RGB(65,71,82) — 蓝通道偏高 |
| `--t-glass-border` | `rgba(162,201,255,0.1)` | 直接使用 primary 蓝色 |
| `--t-surface-container-high` | `#262a31` | RGB(38,42,49) — 微蓝 |
| `--t-surface-container-low` | `#181c22` | RGB(24,28,34) — 微蓝 |
| `--t-surface-container` | `#1c2026` | RGB(28,32,38) — 微蓝 |
| `--t-surface-container-highest` | `#31353c` | RGB(49,53,60) — 微蓝 |
| `--t-surface` | `#10141a` | RGB(16,20,26) — 微蓝 |

**VP2 Monaco 白底：**
`EditorView.tsx` L820-847 中 `<Editor>` 组件没有 `theme` prop，主题放在 `options.theme` 中。`@monaco-editor/react` 在 options 变更时不会重新应用主题。需要直接传 `theme` prop。

### Related Features
- `feat-app-theme-system` (completed) — 全局明暗主题基础设施
- `feat-editor-theme-perf` (completed) — 编辑器渲染优化与深色风格适配

## Technical Solution

### VP1: 调整深色主题色值为灰黑中性调

将 `index.css` `:root[data-theme="dark"]` 中所有 surface 和 outline 相关色值向中性灰黑方向调整：

| 变量 | 旧值 | 新值 | 说明 |
|------|------|------|------|
| `--t-surface` | `#10141a` | `#111111` | 主背景 |
| `--t-surface-container` | `#1c2026` | `#1a1a1a` | 容器背景 |
| `--t-surface-container-low` | `#181c22` | `#161616` | 低容器 |
| `--t-surface-container-high` | `#262a31` | `#252525` | 高容器 |
| `--t-surface-container-highest` | `#31353c` | `#303030` | 最高容器 |
| `--t-surface-container-lowest` | `#0a0e14` | `#0a0a0a` | 最低背景 |
| `--t-outline-variant` | `#414752` | `#333333` | 边框/分割线 |
| `--t-outline` | `#8b919d` | `#888888` | 轮廓线 |
| `--t-app-bg` | `#020617` | `#050505` | App 总背景 |
| `--t-glass-border` | `rgba(162,201,255,0.1)` | `rgba(255,255,255,0.06)` | 玻璃边框 |
| `--t-glass-bg` | `rgba(88,166,255,0.05)` | `rgba(255,255,255,0.03)` | 玻璃背景 |

同步更新 `monaco-theme.ts` 中 `NEURO_DARK_THEME.colors` 的对应色值：
- `'editor.background'`: `#0a0e14` → `#0a0a0a`
- `'editor.lineHighlightBackground'`: `#1c2026` → `#1a1a1a`
- 等等

同步更新 `XTerminal.tsx` 中 `DARK_TERMINAL_THEME`：
- `background`: `#020617` → `#050505`
- 等

同步更新 `EditorView.tsx` 中所有硬编码的 `bg-[#0a0e14]`、`bg-[#1c2026]`、`border-[#262a31]` 等 → 改用 CSS 变量。

### VP2: Monaco 编辑器主题响应式更新

在 `EditorView.tsx` 中：

1. 给 `<Editor>` 组件添加直接 `theme` prop：
```tsx
<Editor
  theme={appTheme === 'dark' ? 'neuro-dark' : 'neuro-light'}
  // ...其他 props
/>
```

2. 添加 useEffect 监听主题变化，调用 `monaco.editor.setTheme()`：
```tsx
useEffect(() => {
  if (!editorRef.current) return;
  import('monaco-editor').then(monaco => {
    monaco.editor.setTheme(appTheme === 'dark' ? 'neuro-dark' : 'neuro-light');
  });
}, [appTheme]);
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望深色主题下所有边框/分割线为中性灰黑色，且 Monaco 编辑器背景能跟随深色主题变为深色。

### Scenarios (Given/When/Then)

#### Scenario 1: 深色主题边框为灰黑色
```gherkin
Given 用户已切换到深色主题
When 查看编辑器文件树分隔线、终端 tab 栏边框、面板边框
Then 所有边框/分割线颜色应为中性灰黑色
And 不应出现明显的蓝色偏移
And glass-panel 边框应为半透明白色（rgba(255,255,255,0.06)）
```

#### Scenario 2: Monaco 编辑器跟随深色主题
```gherkin
Given 用户已打开一个文件在编辑器中
And 当前为浅色主题
When 用户切换到深色主题
Then 编辑器背景应从白色变为深色（#0a0a0a）
And 行号颜色应变为深色主题对应值
And 代码高亮应切换为深色主题配色
```

#### Scenario 3: Monaco 编辑器跟随浅色主题
```gherkin
Given 用户已打开一个文件在编辑器中
And 当前为深色主题
When 用户切换到浅色主题
Then 编辑器背景应变回白色
And 所有编辑器 UI 元素恢复浅色主题配色
```

#### Scenario 4: 主题切换实时生效
```gherkin
Given 编辑器已打开文件且已挂载
When 用户连续快速切换深色/浅色主题
Then 编辑器背景和代码高亮应实时响应每次切换
And 不出现白色闪烁
```

### UI/Interaction Checkpoints
- [ ] 深色主题下所有边框无蓝色偏移
- [x] glass-panel 效果使用中性半透明色
- [x] Monaco 编辑器背景在深色主题下为深色
- [x] Monaco 编辑器在主题切换时无闪烁
- [x] xterm.js 终端背景同步更新
- [x] 编辑器加载 spinner 同步使用新色值

### General Checklist
- [x] 所有硬编码色值已替换为 CSS 变量
- [x] Monaco theme、xterm theme、CSS 变量三者色值一致

## Merge Record

- **Completed:** 2026-04-02
- **Merged Branch:** feature/feat-dark-theme-polish
- **Merge Commit:** 9088029
- **Archive Tag:** feat-dark-theme-polish-20260402
- **Conflicts:** None
- **Verification:** 4/4 Gherkin scenarios PASS, tsc clean, 0 old hex values remaining
- **Files Changed:** 4 (index.css, monaco-theme.ts, XTerminal.tsx, EditorView.tsx)
- **Lines Changed:** +84 / -74
