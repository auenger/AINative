# Tasks: feat-app-theme-system

## Task Breakdown

### 1. CSS 变量多主题架构
- [ ] 在 index.css 中为现有 `@theme` 变量建立亮色/深色两套值
- [ ] 使用 `[data-theme="dark"]` / `[data-theme="light"]` 选择器切换
- [ ] 更新 glass-panel、node-grid 等特殊效果的亮色变体

### 2. ThemeContext + ThemeProvider
- [ ] 创建 `context/ThemeContext.tsx`，提供 theme / setTheme
- [ ] 实现 localStorage 持久化
- [ ] 实现系统偏好检测（`prefers-color-scheme`）
- [ ] 在 App.tsx 中包裹 ThemeProvider

### 3. 主题切换 UI
- [ ] TopNav 添加 Sun/Moon 切换按钮
- [ ] 切换时同步 `document.documentElement.dataset.theme`

### 4. Monaco Editor 主题联动
- [ ] 定义 `neuro-light` Monaco 主题
- [ ] ThemeProvider 变更时动态切换 Monaco 主题

### 5. xterm.js 终端主题联动
- [ ] 定义明暗两套终端配色
- [ ] ThemeProvider 变更时更新终端主题

### 6. 组件硬编码颜色排查与替换
- [ ] 排查所有 views/ 组件中的硬编码颜色
- [ ] 替换为 CSS 变量或 theme-aware class
- [ ] 排查 TopNav / SideNav / StatusBar / BottomPanel

### 7. 验证与测试
- [ ] 亮色主题下各视图完整走查
- [ ] 主题切换流畅性验证
- [ ] 持久化和系统跟随验证

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Created | Feature created from split, depends on feat-editor-theme-perf |
