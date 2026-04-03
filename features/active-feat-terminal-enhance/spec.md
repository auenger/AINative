# Feature: feat-terminal-enhance 编辑器终端能力增强

## Basic Information
- **ID**: feat-terminal-enhance
- **Name**: 编辑器终端能力增强
- **Priority**: 65
- **Size**: M
- **Dependencies**: None
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description
编辑器页面的终端能力增强，涵盖三个方面：
1. 保证终端功能可用 — 确保终端在 Tauri 环境和浏览器 fallback 下均可正常工作
2. 终端 "+" 按钮 hover 样式优化 — 当前 hover 时下拉菜单显示半透明，需要修复为正常可见
3. "+" 按钮打开新终端功能可用 — 点击下拉菜单项应正确创建并切换到新的终端实例

## User Value Points
1. **终端基础可用性** — 用户打开编辑器页面后，终端能正确连接 PTY、显示输出、接受输入
2. **"+" 按钮 UX 优化** — 悬停 "+" 按钮时下拉菜单完整可见，交互流畅自然；点击菜单项能成功创建新终端 tab 并切换到该 tab

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx:906-933` — "+" 按钮及下拉菜单实现
- `neuro-syntax-ide/src/components/XTerminal.tsx` — xterm.js 终端组件
- `neuro-syntax-ide/src/components/BottomPanel.tsx` — 底部面板（AI Task Logs）

### Related Documents
- 已完成 feat-native-terminal（xterm.js 真实终端）
- 已完成 feat-terminal-theme-fix（终端主题一致性修复）
- 已完成 feat-terminal-polish（终端主题跟随 & 显隐控制）

### Related Features
- feat-native-terminal（completed）
- feat-terminal-theme-fix（completed）
- feat-terminal-polish（completed）

## Technical Solution

### 问题分析

#### 1. "+" 按钮 hover 半透明问题
**根因**：`EditorView.tsx:907` 中 "+" 按钮本身设置了 `opacity-50 hover:opacity-100`，但下拉菜单包裹在 `group-hover:block` 的 div 中。当下拉菜单出现时，它继承了父级 group 的透明度设置，或因 `overflow` / `z-index` 问题导致显示不全。

**修复方案**：
- 为下拉菜单添加明确的 `opacity-100` 确保完全可见
- 调整 `group` 容器，确保下拉菜单不受父级 opacity 影响
- 可选：改用 `state` 控制下拉菜单显隐，避免纯 CSS hover 的不稳定性

#### 2. 新终端创建
**现状**：`addTab` 函数（EditorView.tsx:438）已实现创建新 tab 逻辑，包括递增 `_tabCounter`、设置 kind 和 label、更新 tabs 和 activeTabId。

**验证点**：
- 确认 `addTab('bash')` / `addTab('claude')` / `addTab('gemini')` 都能正确创建新 XTerminal 实例
- 确认新 XTerminal 组件会触发 `create_pty` IPC 调用
- 确认 tab 切换后 `active` prop 正确传递，`fitAddon.fit()` 正常执行

#### 3. 终端基础可用性
**验证点**：
- Tauri 环境：PTY 创建、数据收发、resize 同步
- 浏览器 fallback：echo 模式正常工作
- 主题跟随：深色/浅色切换时终端主题同步

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望终端功能完整可用，"+" 按钮交互体验流畅，以便高效使用多个终端实例。

### Scenarios (Given/When/Then)

#### Scenario 1: "+" 按钮 hover 显示完整下拉菜单
```gherkin
Given 编辑器页面已打开且终端面板可见
When 用户将鼠标悬停在终端 tab 栏的 "+" 按钮上
Then 出现包含 "Bash"、"Claude CLI"、"Gemini CLI" 三个选项的下拉菜单
And 下拉菜单完全不透明、背景清晰可读
And 菜单项文字和图标清晰可见
```

#### Scenario 2: 通过 "+" 创建新 Bash 终端
```gherkin
Given 编辑器页面已打开且终端面板可见
When 用户 hover "+" 按钮并点击 "Bash" 菜单项
Then 终端 tab 栏新增一个 "Bash Terminal" tab
And 自动切换到新创建的 tab
And 新终端实例正确初始化并显示 shell 提示符
```

#### Scenario 3: 通过 "+" 创建 AI CLI 终端
```gherkin
Given 编辑器页面已打开且终端面板可见
When 用户 hover "+" 按钮并点击 "Claude CLI" 或 "Gemini CLI"
Then 终端 tab 栏新增对应类型的 tab
And 自动切换到新 tab
And 新终端实例正确启动对应的 CLI 程序
```

#### Scenario 4: 终端基础交互
```gherkin
Given 终端面板可见且至少有一个终端 tab
When 用户在终端中输入命令并按回车
Then 命令被发送到 PTY 进程
And 终端显示命令执行结果
```

### UI/Interaction Checkpoints
- [ ] "+" 按钮下拉菜单 hover 时无闪烁或半透明
- [ ] 下拉菜单项 hover 有背景色变化反馈
- [ ] 新 tab 创建后自动获得焦点
- [ ] 多 tab 切换时终端尺寸自动适配（fit）
- [ ] 关闭 tab 后正确切换到相邻 tab

### General Checklist
- [ ] 不影响已有终端 tab 的功能
- [ ] 浏览器 fallback 模式下不报错
- [ ] 深色/浅色主题下 "+" 按钮及下拉菜单均正常显示
