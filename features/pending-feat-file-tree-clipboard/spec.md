# Feature: feat-file-tree-clipboard 文件剪贴板操作（复制/剪切/粘贴/移动）

## Basic Information
- **ID**: feat-file-tree-clipboard
- **Name**: 文件树剪贴板操作（复制/剪切/粘贴/移动）
- **Priority**: 80
- **Size**: S
- **Dependencies**: feat-file-tree-context-menu
- **Parent**: feat-file-tree-ops
- **Children**: 无
- **Created**: 2026-04-27

## Description
在文件树右键菜单基础上，增加文件/文件夹的复制、剪切、粘贴操作。支持通过剪贴板在文件树中移动和复制文件到目标文件夹。

## User Value Points
1. 复制/粘贴 — 将文件复制到目标文件夹，保留原文件
2. 剪切/粘贴 — 将文件移动到目标文件夹
3. 拖拽移动 — 直接拖拽文件到目标文件夹完成移动

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 文件树组件
- ContextMenu 组件（来自 feat-file-tree-context-menu）

### Related Documents
- CLAUDE.md

### Related Features
- feat-file-tree-context-menu（前置依赖）

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望能在文件树中复制/剪切/粘贴文件和文件夹，以便在不同目录间快速组织文件。

### Scenarios (Given/When/Then)

#### Scenario 1: 复制并粘贴文件
```gherkin
Given 文件树已加载
When 用户右键点击文件 A 并选择"复制"
And 用户右键点击目标文件夹 B 并选择"粘贴"
Then 文件 A 被复制到文件夹 B 下
And 文件树刷新显示新文件
And 如果目标位置存在同名文件，自动添加后缀（如 -copy）
```

#### Scenario 2: 剪切并粘贴文件
```gherkin
Given 文件树已加载
When 用户右键点击文件 A 并选择"剪切"
And 用户右键点击目标文件夹 B 并选择"粘贴"
Then 文件 A 被移动到文件夹 B 下
And 原位置不再显示文件 A
```

#### Scenario 3: 粘贴到同一文件夹（复制场景）
```gherkin
Given 用户已复制文件 A（位于文件夹 B 中）
When 用户右键点击文件夹 B 并选择"粘贴"
Then 创建文件 A 的副本，命名为 "A - copy"
```

#### Scenario 4: 拖拽移动文件
```gherkin
Given 文件树已加载
When 用户将文件 A 拖拽到文件夹 B 上并释放
Then 文件 A 被移动到文件夹 B 下
And 文件树刷新显示更新后的结构
```

#### Scenario 5: 剪贴板状态可视化
```gherkin
Given 用户对文件 A 执行了"剪切"
Then 文件 A 在文件树中以半透明/虚线样式显示
When 用户执行粘贴或按 Esc
Then 文件 A 的样式恢复正常
```

### UI/Interaction Checkpoints
- 剪切状态的文件用半透明样式标识
- 粘贴菜单项在剪贴板为空时禁用（灰色）
- 拖拽时目标文件夹高亮
- 冲突文件名自动重命名（-copy 后缀）

### General Checklist
- [ ] Rust 后端新增 copy_entry、move_entry 命令
- [ ] 前端剪贴板状态管理（store 刍型）
- [ ] 拖拽功能（drag & drop）
- [ ] 文件名冲突处理
