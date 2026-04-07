# Feature: feat-editor-terminal-workspace 编辑器终端工作空间目录绑定

## Basic Information
- **ID**: feat-editor-terminal-workspace
- **Name**: 编辑器终端工作空间目录绑定
- **Priority**: 55
- **Size**: M
- **Dependencies**: None
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-07

## Description
编辑器 Tab 进入时对应的 bash 终端默认关闭，用户按需打开。打开终端时确认终端的工作目录 (cwd) 是当前工作空间目录，并确保终端可用。

## User Value Points
1. **终端默认关闭** — 进入编辑器视图时终端面板收起，不占用屏幕空间，用户按需点击打开
2. **工作空间目录绑定** — bash 终端启动时 cwd 设置为 workspacePath，用户在终端中可直接操作项目文件

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx:264` — `terminalOpen` 默认 `true`，需改为 `false`
- `neuro-syntax-ide/src/components/XTerminal.tsx:177` — `invoke('create_pty', { config: { shell, args, cols, rows } })` 缺少 `cwd` 参数
- `neuro-syntax-ide/src/components/XTerminal.tsx:30-41` — `shellForKind()` 返回 shell 配置，需扩展支持 cwd
- `src-tauri/src/lib.rs` — Rust 端 `create_pty` command 需接受 `cwd` 字段

### Related Documents
- `project-context.md` — Phase 3: 终端与编辑器

### Related Features
- feat-editor-tab-overflow (pending) — 编辑器 Tab 溢出优化

## Technical Solution
- `EditorView.tsx`: `terminalOpen` 初始值从 `true` 改为 `false`
- `XTerminal.tsx`: 新增 `cwd?: string` prop，传入 `create_pty` config
- `lib.rs`: `PtyConfig` 新增 `cwd: Option<String>` 字段，PTY 创建时 `cmd.cwd()` 设置工作目录
- 无工作空间时终端使用默认 home 目录

## Merge Record
- **Completed:** 2026-04-07
- **Merged Branch:** feature/feat-editor-terminal-workspace
- **Merge Commit:** 7d4c4f3
- **Archive Tag:** feat-editor-terminal-workspace-20260407
- **Conflicts:** None
- **Verification:** PASSED (5/5 Gherkin scenarios, Vite build OK, Cargo check OK)
- **Stats:** 1 commit, 3 files changed, started 2026-04-07T17:15:00Z

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望进入编辑器时终端默认收起、打开时自动定位到项目目录，这样我可以专注于代码编辑，需要终端时不用手动 cd。

### Scenarios (Given/When/Then)

#### Scenario 1: 终端默认关闭
```gherkin
Given 用户已打开一个工作空间
When 用户切换到编辑器视图
Then 底部终端面板处于关闭状态
And 右下角显示终端打开按钮
```

#### Scenario 2: 打开终端定位到工作空间目录
```gherkin
Given 用户已打开工作空间 "/path/to/my-project"
And 终端面板处于关闭状态
When 用户点击终端打开按钮
Then 终端面板展开
And bash 终端的当前工作目录为 "/path/to/my-project"
And 终端可以正常输入和执行命令
```

#### Scenario 3: 多终端标签均使用工作空间目录
```gherkin
Given 用户已打开工作空间 "/path/to/my-project"
And 终端面板已打开
When 用户通过 "+" 按钮添加新的 bash 终端标签
Then 新 bash 终端的当前工作目录为 "/path/to/my-project"
```

#### Scenario 4: 浏览器开发模式降级
```gherkin
Given 应用运行在浏览器中（非 Tauri 环境）
When 用户打开终端面板
Then 终端显示 "Running in browser" 提示
And 不传递 cwd 参数（浏览器模式无需真实 PTY）
```

#### Scenario 5: 未选择工作空间时打开终端
```gherkin
Given 用户未选择任何工作空间
When 用户打开终端面板
Then bash 终端使用用户 home 目录作为 cwd
And 终端正常可用
```

### UI/Interaction Checkpoints
- 终端关闭时，编辑区域占满高度，右下角显示终端图标按钮
- 终端打开时，面板从底部滑出（motion 动画），高度 240px
- 终端面板内显示工作空间路径标识（可选，如 tab tooltip）

### General Checklist
- [x] 不影响现有终端功能（多标签、Claude CLI、Gemini CLI）
- [x] 支持 dark/light 主题切换
- [x] 支持 Tauri 环境和浏览器开发模式
