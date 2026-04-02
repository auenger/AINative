# Tasks: feat-dark-theme-polish

## Task Breakdown

### 1. index.css — 深色主题色值灰黑中性化
- [ ] 更新 `--t-surface` 系列变量为中性灰黑（去除蓝色偏移）
- [ ] 更新 `--t-outline-variant` 和 `--t-outline` 为中性灰
- [ ] 更新 `--t-app-bg` 为纯深色
- [ ] 更新 `--t-glass-border` 和 `--t-glass-bg` 为半透明白色
- [ ] 更新 `--t-editor-bg`、`--t-editor-bg-alt` 等编辑器变量

### 2. monaco-theme.ts — 同步深色主题色值
- [ ] 更新 `NEURO_DARK_THEME.colors` 中所有 `#0a0e14` → `#0a0a0a`
- [ ] 更新 `NEURO_DARK_THEME.colors` 中所有 `#1c2026` → `#1a1a1a`
- [ ] 更新 `NEURO_DARK_THEME.colors` 中所有 `#262a31` → `#252525`
- [ ] 更新 `NEURO_DARK_THEME.colors` 中所有 `#414752` → `#333333`

### 3. XTerminal.tsx — 同步终端深色主题
- [ ] 更新 `DARK_TERMINAL_THEME.background` 为中性深色
- [ ] 更新 `DARK_TERMINAL_THEME.black` 为中性深色

### 4. EditorView.tsx — Monaco 编辑器主题跟随修复
- [ ] 给 `<Editor>` 组件添加直接 `theme` prop
- [ ] 添加 `useEffect` 监听 `appTheme` 变化并调用 `monaco.editor.setTheme()`
- [ ] 将硬编码的 `bg-[#0a0e14]`、`border-[#262a31]`、`bg-[#1c2026]` 等替换为 CSS 变量引用
- [ ] 更新 spinner 加载动画中的硬编码色值为 CSS 变量

### 5. 验证
- [ ] 深色主题下边框颜色为中性灰黑
- [ ] Monaco 编辑器深色主题正确生效
- [ ] 浅色 ↔ 深色切换编辑器实时更新
- [ ] 终端背景同步更新

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Created | Feature request created |
