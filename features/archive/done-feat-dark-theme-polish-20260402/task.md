# Tasks: feat-dark-theme-polish

## Task Breakdown

### 1. index.css — 深色主题色值灰黑中性化
- [x] 更新 `--t-surface` 系列变量为中性灰黑（去除蓝色偏移）
- [x] 更新 `--t-outline-variant` 和 `--t-outline` 为中性灰
- [x] 更新 `--t-app-bg` 为纯深色
- [x] 更新 `--t-glass-border` 和 `--t-glass-bg` 为半透明白色
- [x] 更新 `--t-editor-bg`、`--t-editor-bg-alt` 等编辑器变量

### 2. monaco-theme.ts — 同步深色主题色值
- [x] 更新 `NEURO_DARK_THEME.colors` 中所有 `#0a0e14` → `#0a0a0a`
- [x] 更新 `NEURO_DARK_THEME.colors` 中所有 `#1c2026` → `#1a1a1a`
- [x] 更新 `NEURO_DARK_THEME.colors` 中所有 `#262a31` → `#252525`
- [x] 更新 `NEURO_DARK_THEME.colors` 中所有 `#414752` → `#333333`

### 3. XTerminal.tsx — 同步终端深色主题
- [x] 更新 `DARK_TERMINAL_THEME.background` 为中性深色
- [x] 更新 `DARK_TERMINAL_THEME.black` 为中性深色

### 4. EditorView.tsx — Monaco 编辑器主题跟随修复
- [x] 给 `<Editor>` 组件添加直接 `theme` prop
- [x] 添加 `useEffect` 监听 `appTheme` 变化并调用 `monaco.editor.setTheme()`
- [x] 将硬编码的 `bg-[#0a0e14]`、`border-[#262a31]`、`bg-[#1c2026]` 等替换为 CSS 变量引用
- [x] 更新 spinner 加载动画中的硬编码色值为 CSS 变量

### 5. 验证
- [x] 深色主题下边框颜色为中性灰黑
- [x] Monaco 编辑器深色主题正确生效
- [x] 浅色 ↔ 深色切换编辑器实时更新
- [x] 终端背景同步更新

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Created | Feature request created |
| 2026-04-02 | Implemented | All 4 task groups completed, tsc passes |
| 2026-04-02 | Verified | 4/4 Gherkin scenarios pass, 0 old hex values remaining |
