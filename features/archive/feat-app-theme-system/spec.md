# Feature: feat-app-theme-system 全局明暗主题系统

## Basic Information
- **ID**: feat-app-theme-system
- **Name**: 全局明暗主题系统
- **Priority**: 65
- **Size**: M
- **Dependencies**: feat-editor-theme-perf
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description

为整个 Neuro Syntax IDE App 建立完整的明暗主题切换能力。当前 App 仅支持深色主题，所有颜色硬编码在 CSS 变量和 Tailwind class 中。需要建立 ThemeProvider、明/暗两套色板、主题切换 UI，并确保所有组件在两种主题下正确渲染。

## User Value Points

### VP1: 主题切换能力
用户可以在 App 设置或顶栏中一键切换明暗主题，App 立即响应切换，无需刷新。

### VP2: 亮色主题完整体验
亮色主题不只是"把背景变白"，而是提供一套精心设计的亮色色板，让所有组件（导航栏、面板、编辑器、终端、看板、弹窗等）在亮色模式下同样美观可用。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/index.css` — 当前深色 CSS 变量体系（`@theme` block）
- `neuro-syntax-ide/src/components/TopNav.tsx` — 顶栏，适合放主题切换入口
- `neuro-syntax-ide/src/components/SideNav.tsx` — 侧边栏
- `neuro-syntax-ide/src/components/views/*.tsx` — 所有视图组件
- `neuro-syntax-ide/src/App.tsx` — 根组件，适合放 ThemeProvider

### Current State
- 仅深色主题，所有 CSS 变量只定义了一套深色值
- Tailwind v4 的 `@theme` block 不支持多主题（需要改为 CSS 变量 + class 切换）
- 无 ThemeContext / ThemeProvider
- Monaco Editor 使用 `vs-dark` 主题（feat-editor-theme-perf 会改为自定义主题）
- xterm.js 终端使用深色配色
- 各组件大量使用 Tailwind 直接颜色 class（如 `text-[#dfe2eb]`, `bg-[#020617]`）

### Related Documents
- project-context.md Design System 章节

### Related Features
- feat-editor-theme-perf (前置依赖，Monaco 深色主题适配)
- feat-editor-monaco (已完成)

## Technical Solution

### 1. CSS 变量多主题架构
```css
/* index.css */
:root {
  /* 亮色主题（默认或通过 class 切换） */
  --color-surface: #f8f9fa;
  --color-surface-container: #ffffff;
  --color-surface-container-low: #f1f3f5;
  /* ... */
}

:root[data-theme="dark"] {
  /* 深色主题 */
  --color-surface: #10141a;
  --color-surface-container: #1c2026;
  /* ... 现有值 ... */
}
```

### 2. ThemeContext + ThemeProvider
```tsx
// context/ThemeContext.tsx
type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>();

// 检测系统偏好、localStorage 持久化、document.documentElement.dataset.theme 同步
```

### 3. 主题切换 UI
- TopNav 右侧添加 Sun/Moon 图标切换按钮
- 可选：设置视图中添加主题选择（light / dark / system）

### 4. Monaco Editor 主题联动
- feat-editor-theme-perf 定义的 `neuro-dark` 主题基础上，新增 `neuro-light` 主题
- ThemeProvider 变更时自动切换 Monaco 主题

### 5. xterm.js 终端主题联动
- 定义明暗两套终端配色方案
- ThemeProvider 变更时更新终端主题

### 6. 组件适配
- 排查所有硬编码颜色的 Tailwind class，替换为 CSS 变量引用
- 确保 glass-panel、node-grid 等特殊效果在亮色主题下也有对应样式

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我期望能够在 Neuro Syntax IDE 中自由切换明暗主题，两种模式下所有界面元素都美观可用。

### Scenarios

#### Scenario 1: 主题切换即时生效
```gherkin
Given 用户当前使用深色主题
When 用户点击顶栏的主题切换按钮
Then App 立即切换到亮色主题
And 所有组件（导航、面板、编辑器、终端、看板）的颜色正确更新
And 切换过程无闪烁
```

#### Scenario 2: 主题偏好持久化
```gherkin
Given 用户选择了深色主题
When 用户关闭并重新打开 App
Then App 仍使用深色主题
```

#### Scenario 3: 跟随系统主题
```gherkin
Given 用户选择主题模式为 "system"
And 操作系统当前为深色模式
Then App 自动使用深色主题
When 操作系统切换到浅色模式
Then App 自动跟随切换到亮色主题
```

#### Scenario 4: 编辑器主题联动
```gherkin
Given 用户切换到亮色主题
When 用户打开一个代码文件
Then Monaco 编辑器应使用对应的亮色主题
And 语法高亮颜色在亮色背景下清晰可读
```

### UI/Interaction Checkpoints
- [ ] 亮色主题色板设计协调
- [ ] 所有硬编码颜色替换为 CSS 变量
- [ ] glass-panel 亮色变体
- [ ] 编辑器明暗主题联动
- [ ] 终端明暗主题联动
- [ ] 主题切换过渡动画（可选）

### General Checklist
- [ ] 不影响现有深色主题的视觉效果
- [ ] 亮色主题下所有文字对比度符合可读性标准
- [ ] ThemeProvider 不引入性能问题
