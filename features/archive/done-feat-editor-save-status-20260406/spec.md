# Feature: feat-editor-save-status 编辑器保存状态优化

## Basic Information
- **ID**: feat-editor-save-status
- **Name**: 编辑器保存状态优化（移除 Run 按钮 + 保存按钮状态可视化 + 快捷键）
- **Priority**: 80
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06T13:00:00Z

## Description

编辑器页面右上角当前有两个按钮：保存和运行。运行按钮无功能，应移除。保存按钮需要更好地展示文件编辑状态（是否已修改），点击保存或 Ctrl/Cmd+S 触发保存。

### 现状分析
- **Save 按钮** (`EditorView.tsx:822-834`): 已有 `isDirty` 状态追踪，dirty 时可点击、非 dirty 时 disabled
- **Run 按钮** (`EditorView.tsx:836-840`): 仅 UI 占位，无 click handler，应移除
- **键盘快捷键** (`EditorView.tsx:418-427`): Cmd/Ctrl+S 已实现
- **Dirty 状态** (`types.ts:50`): `OpenFileState.isDirty` 已追踪
- **Tab 上红点** (`EditorView.tsx:804-806`): 已有 dirty 标识

### 改进目标
1. 移除无用的 Run 按钮
2. Save 按钮在 dirty 时更醒目（视觉反馈增强）
3. 非 dirty 状态时 Save 按钮变为「已保存」状态指示器（而不仅仅是 disabled）

## User Value Points

### VP1: 清晰的文件编辑状态指示
用户一眼就能看出当前文件是否已修改、是否已保存。保存按钮既是操作按钮也是状态指示器。

### VP2: 干净的工具栏
移除无用的 Run 按钮，减少视觉干扰。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 编辑器主组件
  - Save 按钮: L822-834
  - Run 按钮: L836-840
  - saveActiveFile: L396-413
  - handleEditorChange (设置 dirty): L449-459
  - Cmd+S 快捷键: L418-427
- `neuro-syntax-ide/src/types.ts` — `OpenFileState.isDirty` (L50)

### Related Documents
- i18n 翻译文件可能需要添加「已保存」相关文案

### Related Features
- `feat-editor-monaco` — Monaco 编辑器基础功能
- `feat-fix-read-file` — 编辑器文件读写修复

## Technical Solution

### 1. 移除 Run 按钮
删除 `EditorView.tsx:836-840` 的 Run 按钮代码，以及顶部的 `Play` 图标 import（如无其他引用）。

### 2. 增强 Save 按钮状态
将 Save 按钮改造为状态指示器 + 操作按钮：
- **已保存 (isDirty=false)**: 显示 ✓ 图标 + 灰色「已保存」文案，不可点击
- **已修改 (isDirty=true)**: 显示 ● 圆点（醒目颜色）+ 「保存」文案，可点击

### 3. 确认快捷键
Cmd/Ctrl+S 快捷键已实现，无需改动。确认功能正常即可。

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望编辑器工具栏清晰地展示当前文件的编辑状态，并能方便地保存文件。

### Scenarios (Given/When/Then)

```gherkin
Scenario: 文件未修改时显示已保存状态
  Given 用户打开了一个文件
  And 文件内容未做任何修改
  Then 工具栏右侧显示「已保存」状态（灰色文字 + ✓ 图标）
  And 保存按钮不可点击

Scenario: 文件修改后显示未保存状态
  Given 用户打开了一个文件
  When 用户编辑了文件内容
  Then 工具栏右侧保存按钮变为活跃状态（醒目颜色 + 「保存」文案）
  And 对应 Tab 上出现红点标识

Scenario: 点击保存按钮保存文件
  Given 用户已修改文件内容（isDirty=true）
  When 用户点击保存按钮
  Then 文件内容写入磁盘
  And 保存按钮恢复为「已保存」状态
  And Tab 上红点消失

Scenario: 使用快捷键保存文件
  Given 用户已修改文件内容（isDirty=true）
  When 用户按下 Cmd+S（macOS）或 Ctrl+S（Windows/Linux）
  Then 文件内容写入磁盘
  And 保存按钮恢复为「已保存」状态

Scenario: 工具栏无 Run 按钮
  Given 用户打开编辑器页面
  Then 工具栏右侧只有保存状态按钮
  And 不显示 Run 按钮
```

### UI/Interaction Checkpoints
- [ ] 保存按钮在 dirty/非 dirty 状态间切换有明显视觉差异
- [ ] 移除 Run 按钮后工具栏布局无异常
- [ ] Tab 红点与保存按钮状态同步

### General Checklist
- [x] 不影响多 Tab 编辑场景
- [x] 不影响文件切换时的状态恢复

## Merge Record

- **Completed**: 2026-04-06T17:00:00Z
- **Merged Branch**: feature/feat-editor-save-status
- **Merge Commit**: 78765de
- **Archive Tag**: feat-editor-save-status-20260406
- **Conflicts**: none
- **Verification**: passed (5/5 Gherkin scenarios, 9/9 tasks)
- **Stats**: 2 files changed, 22 insertions(+), 20 deletions(-), 1 commit
