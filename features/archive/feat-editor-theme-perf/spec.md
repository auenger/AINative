# Feature: feat-editor-theme-perf 编辑器渲染优化与深色风格适配

## Basic Information
- **ID**: feat-editor-theme-perf
- **Name**: 编辑器渲染优化与深色风格适配
- **Priority**: 75
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description

编辑器 Tab 选中文件后 Monaco Editor 渲染速度偏慢，且编辑器区域显示为纯白色背景，与 App 整体的深色科幻风格严重不协调。需要优化渲染性能并让 Monaco Editor 融入当前设计系统。

## User Value Points

### VP1: 编辑器渲染性能优化
用户点击文件后，编辑器应快速响应并完成渲染，不出现明显的白屏闪烁或加载延迟。

### VP2: 编辑器深色风格适配
Monaco Editor 的外观（背景色、语法高亮、侧边栏、minimap、光标等）应与 App 的深色科幻风设计系统（`#0a0e14`~`#1e2330` 色阶、`#a2c9ff` 主色）保持视觉统一。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — Monaco Editor 集成，使用 `vs-dark` 内置主题
- `neuro-syntax-ide/src/index.css` — CSS 变量定义深色设计系统
- `@monaco-editor/react` v4.7.0 — 编辑器组件库

### Current State
- Monaco 使用 `React.lazy()` 懒加载，首次加载可能有延迟
- 主题硬编码为 `'vs-dark'`，不匹配自定义深色调
- 文件切换时可能出现短暂白闪
- 无自定义 Monaco theme token 配置

### Related Documents
- project-context.md Design System 章节

### Related Features
- feat-editor-monaco (已完成，初始 Monaco 集成)
- feat-app-theme-system (依赖本功能)

## Technical Solution

### 1. Monaco 自定义主题
```typescript
// 定义与 App 设计系统一致的 Monaco 主题
monaco.editor.defineTheme('neuro-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '4a5568', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a2c9ff' },
    { token: 'string', foreground: '67df70' },
    { token: 'number', foreground: 'ffb4ab' },
    // ...
  ],
  colors: {
    'editor.background': '#0a0e14',        // 匹配 --color-surface-container-lowest
    'editor.foreground': '#dfe2eb',
    'editor.lineHighlightBackground': '#1c2026',
    'editorLineNumber.foreground': '#414752',
    'editor.selectionBackground': '#58a6ff40',
    'editorCursor.foreground': '#a2c9ff',
    // ...
  }
});
```

### 2. 渲染性能优化
- 预加载 Monaco：使用 `<link rel="preload">` 或 `import()` prefetch
- 文件切换时保持 editor instance，仅更新 model/value
- 减少不必要的 re-render（useMemo/useCallback 审查）
- 添加 loading skeleton 替代白屏

### 3. 白闪消除
- Monaco 容器设置与主题一致的背景色（CSS fallback）
- editor mount 前显示骨架屏

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我期望在编辑器 Tab 中点击文件时，编辑器能快速渲染并以深色风格显示代码，不出现白闪。

### Scenarios

#### Scenario 1: 编辑器深色主题一致性
```gherkin
Given 用户已打开 Editor 视图
When 用户在文件树中点击任意代码文件
Then Monaco 编辑器背景色应为 #0a0e14（非白色）
And 编辑器侧边栏、minimap、行号区域应使用 App 深色色阶
And 语法高亮颜色应与 App 主色系协调（主色 #a2c9ff, 成功 #67df70）
```

#### Scenario 2: 文件切换无白闪
```gherkin
Given 用户已在一个文件标签页中查看代码
When 用户点击另一个文件标签
Then 编辑器内容应平滑切换
And 不应出现白色闪烁或长时间空白
And loading 状态应显示深色骨架屏（非白色）
```

#### Scenario 3: 大文件加载保护
```gherkin
Given 用户尝试打开一个较大文件（接近 1MB 限制）
When 文件内容开始加载
Then 编辑器应显示深色 loading 状态
And 加载完成后应正确渲染内容
And 加载期间 UI 不应冻结
```

### UI/Interaction Checkpoints
- [ ] Monaco 背景与 App 背景无缝衔接
- [ ] 语法高亮配色与整体设计语言统一
- [ ] Tab 切换无白闪
- [ ] Loading 状态使用深色骨架屏

### General Checklist
- [ ] 不引入新的性能回归
- [ ] 编辑器功能（语法高亮、代码折叠、minimap）正常工作
- [ ] 保持现有文件操作（打开/保存/关闭）功能正常
