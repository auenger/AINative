# Feature: feat-editor-monaco Monaco Editor 代码编辑器

## Basic Information
- **ID**: feat-editor-monaco
- **Name**: Monaco Editor 代码编辑器
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-workspace-loader
- **Parent**: epic-neuro-syntax-ide-roadmap
- **Created**: 2026-04-01

## Description

用 Monaco Editor 替换 EditorView 中的 `pre/code` 代码预览区域，实现 VS Code 级别的代码编辑体验。支持多 Tab 文件打开、语法高亮、Cmd+S 保存，以及外部文件变更感知。

## User Value Points

### VP1: 专业代码编辑体验
双击文件树中的文件在 Monaco Editor 中打开，获得语法高亮、代码折叠、行号等 VS Code 级别的编辑体验。

### VP2: 多 Tab + 保存
支持同时打开多个文件以 Tab 形式切换，编辑后 Cmd+S 直接保存到本地磁盘。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 打开代码文件
  Given 工作区已加载，文件树可见
  When 用户双击文件树中的一个 .tsx 文件
  Then Monaco Editor 打开该文件并显示 TypeScript 语法高亮
  And 文件标签页显示文件名

Scenario: 多 Tab 切换
  Given 已打开 2 个文件
  When 用户点击另一个 Tab
  Then 编辑器切换到对应文件内容
  And 光标位置和滚动状态保持

Scenario: 保存文件
  Given 用户在编辑器中修改了文件内容
  When 用户按下 Cmd+S
  Then Rust 后端将内容写入磁盘
  And 文件标签页的修改标记消失
  And 文件监听器感知到变更

Scenario: 外部变更感知
  Given 用户在 VS Code 中修改了 IDE 当前打开的文件
  Then Monaco Editor 检测到文件变更
  And 提示用户"文件已被外部修改，是否重新加载"
```

## Technical Solution

### 前端
- 安装 `@monaco-editor/react`
- EditorView 中央区域替换 `pre/code` 为 `<Editor>` 组件
- Tab 状态管理: `openFiles: Map<string, { content, language, isDirty }>`
- 语言映射: `.tsx`→typescript, `.yaml`→yaml, `.md`→markdown, `.rs`→rust
- Cmd+S 快捷键绑定 → `invoke('write_file', { path, content })`

### Rust
- `read_file(path)` — 读取文件内容
- `write_file(path, content)` — 写入文件 (原子操作)
- Monaco 的 `onDidChangeModelContent` → 标记 isDirty

### 性能考量
- Monaco Editor 按需加载 (React.lazy)
- 大文件 (>1MB) 只加载前部分内容并提示
- Tab 切换时保留 Model，不销毁
