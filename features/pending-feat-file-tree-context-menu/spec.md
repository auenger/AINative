# Feature: feat-file-tree-context-menu 右键上下文菜单与基础操作

## Basic Information
- **ID**: feat-file-tree-context-menu
- **Name**: 文件树右键上下文菜单与基础操作
- **Priority**: 80
- **Size**: S
- **Dependencies**: 无
- **Parent**: feat-file-tree-ops
- **Children**: 无
- **Created**: 2026-04-27

## Description
为文件树添加右键上下文菜单，支持新建文件/文件夹、重命名、删除等基础操作。这是文件树操作增强的基础模块，提供菜单框架和 CRUD 能力。

## User Value Points
1. 右键菜单框架 — 统一的上下文菜单组件，支持图标、快捷键提示、分割线
2. 新建文件/文件夹 — 在指定目录下创建新文件或文件夹
3. 重命名与删除 — 对已有文件/文件夹进行重命名和删除操作

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 当前文件树组件
- `neuro-syntax-ide/src/types.ts` — FileNode 类型定义
- `src-tauri/src/commands/` — 现有文件操作命令

### Related Documents
- CLAUDE.md — 项目架构说明

### Related Features
- feat-file-tree-resizable（已完成）— 文件树宽度拖拽

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望在文件树中右键点击文件/文件夹时弹出上下文菜单，以便快速执行新建、重命名、删除等文件操作。

### Scenarios (Given/When/Then)

#### Scenario 1: 右键文件弹出上下文菜单
```gherkin
Given 文件树已加载并显示文件列表
When 用户右键点击某个文件
Then 应在鼠标位置弹出一组上下文菜单
And 菜单包含"新建文件"、"新建文件夹"、"重命名"、"删除"、"复制路径"选项
And 菜单使用项目设计系统样式
```

#### Scenario 2: 右键文件夹弹出上下文菜单
```gherkin
Given 文件树已加载并显示文件夹
When 用户右键点击某个文件夹
Then 上下文菜单包含"新建文件"、"新建文件夹"、"重命名"、"删除"、"复制路径"选项
And "新建文件"和"新建文件夹"操作在当前文件夹下创建
```

#### Scenario 3: 新建文件
```gherkin
Given 用户右键点击了一个文件夹并选择"新建文件"
Then 在该文件夹下创建一个可编辑的临时文件名输入框
When 用户输入文件名并按 Enter
Then 通过 Tauri IPC 调用后端创建文件
And 文件树刷新显示新文件
```

#### Scenario 4: 删除文件确认
```gherkin
Given 用户右键点击了一个文件并选择"删除"
Then 弹出确认对话框显示即将删除的文件名
When 用户点击"确认"
Then 通过 Tauri IPC 调用后端删除文件
And 文件树刷新移除已删除项
```

#### Scenario 5: 重命名文件
```gherkin
Given 用户右键点击了一个文件并选择"重命名"
Then 文件名变为可编辑输入框，预填当前文件名
When 用户修改名称并按 Enter
Then 通过 Tauri IPC 调用后端重命名文件
And 文件树刷新显示新名称
```

#### Scenario 6: 右键空白区域
```gherkin
Given 文件树已加载
When 用户右键点击文件树的空白区域
Then 弹出菜单包含"新建文件"、"新建文件夹"、"刷新"选项
```

### UI/Interaction Checkpoints
- 右键菜单使用暗色主题，与 IDE 整体风格一致
- 菜单项带图标和快捷键提示（如 Delete, F2）
- 新建/重命名使用 inline 编辑模式，不弹模态框
- 删除操作需要二次确认

### General Checklist
- [ ] Rust 后端新增 create_file、create_dir、delete_file、rename_file 命令
- [ ] 前端 ContextMenu 组件可复用
- [ ] 操作后自动刷新文件树
- [ ] 错误处理（权限不足、文件已存在等）
