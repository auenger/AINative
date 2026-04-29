# Feature: feat-git-file-interaction 文件变更交互增强

## Basic Information
- **ID**: feat-git-file-interaction
- **Name**: 文件变更交互增强
- **Priority**: 80
- **Size**: S
- **Dependencies**: feat-git-tab-page
- **Parent**: feat-git-tab-redesign
- **Children**: []
- **Created**: 2026-04-27

## Description
强化 Git Changes 面板中文件变更列表的交互能力：支持多选文件（Shift 范围选、Ctrl/Cmd 单选）、拖拽文件在 Staged/Unstaged 区域之间移动、批量 Stage/Unstage/Reset 操作、全选/反选快捷操作。提升大量文件变更时的操作效率。

## User Value Points
1. **批量操作效率** — 多选 + 批量 Stage/Unstage，不再逐个文件操作
2. **直观的拖拽体验** — 拖拽文件到不同区域完成 staging/unstaging，操作更自然
3. **快捷操作** — 全选、反选、键盘快捷键支持，提升高级用户效率

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — Changes 标签（lines 2171-2307）
  - 文件分组：staged/unstaged/untracked
  - 单个文件 Stage/Unstage 按钮
  - FileDiffInfo 接口：{ path, status, additions, deletions }
- `neuro-syntax-ide/src-tauri/src/lib.rs` — `git_stage_file` / `git_unstage_file` Commands
- `neuro-syntax-ide/src/types.ts` — FileDiffInfo 类型定义

### Related Documents
- project-context.md

### Related Features
- feat-git-tab-page（前置依赖）

## Technical Solution
- **Frontend**: GitView.tsx extended with FileRow component (selection + drag), BatchActionBar component, keyboard shortcut listeners
- **Backend**: 3 new Tauri commands: `git_unstage_all`, `git_batch_stage_files`, `git_batch_unstage_files`
- **Multi-select**: Set<string> state with Shift range, Ctrl/Cmd toggle, single click
- **Drag & drop**: HTML5 DnD API with dataTransfer, drop zone highlighting per group
- **Batch ops**: BatchActionBar renders at bottom of Changes tab with Stage/Unstage Selected and All buttons

## Merge Record
- **Completed**: 2026-04-28T16:30:00Z
- **Merged Branch**: feature/feat-git-file-interaction
- **Merge Commit**: f8c401d
- **Archive Tag**: feat-git-file-interaction-20260428
- **Conflicts**: None
- **Verification**: All 6 Gherkin scenarios passed
- **Files Changed**: 5 (GitView.tsx, lib.rs, task.md, checklist.md, verification-report.md)

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，当我有大量文件变更时，我希望可以多选和拖拽文件来批量操作，而不是逐个文件点击。

### Scenarios (Given/When/Then)

#### 场景 1：多选文件
```gherkin
Given Git Changes 面板显示 5 个未暂存文件
When 用户点击第 1 个文件，然后 Shift+点击第 4 个文件
Then 第 1-4 个文件全部选中高亮
And 底部出现批量操作栏（Stage Selected / Discard Selected）
```

#### 场景 2：Ctrl/Cmd 单选
```gherkin
Given Git Changes 面板显示 5 个未暂存文件
When 用户 Ctrl/Cmd+点击第 1、3、5 个文件
Then 这 3 个文件选中高亮，其余不选
And 底部出现批量操作栏
```

#### 场景 3：拖拽 Staging
```gherkin
Given Git Changes 面板有 Staged 和 Unstaged 两个区域
When 用户从 Unstaged 区域拖拽 1 个文件到 Staged 区域
Then Staged 区域在拖拽进入时高亮提示"释放以暂存"
And 释放后文件从 Unstaged 移到 Staged 列表
And Git 状态实时更新
```

#### 场景 4：批量拖拽
```gherkin
Given 用户已选中 3 个未暂存文件
When 用户拖拽其中任一选中文件到 Staged 区域
Then 3 个文件全部跟随拖拽
And 释放后 3 个文件全部暂存
```

#### 场景 5：全选快捷键
```gherkin
Given Git Changes 面板显示文件列表
When 用户按下 Ctrl/Cmd+A
Then 当前分组下所有文件选中
And 底部出现批量操作栏
```

#### 场景 6：批量 Stage 操作
```gherkin
Given 用户选中了 3 个未暂存文件
When 用户点击"Stage Selected"按钮
Then 3 个文件全部移到 Staged 区域
And 显示操作成功提示
```

### UI/Interaction Checkpoints
- 选中文件行背景色变化（使用主色半透明）
- 拖拽时文件行变为半透明跟随光标
- 目标区域在拖拽悬停时高亮（虚线边框 + 背景色变化）
- 批量操作栏固定在 Changes 面板底部
- 多选数量 badge 显示
- Escape 取消全选

### General Checklist
- [ ] 多选逻辑实现（Shift + Ctrl/Cmd）
- [ ] 拖拽 staging/unstaging 实现
- [ ] 批量操作按钮（Stage All / Unstage All / Stage Selected / Unstage Selected）
- [ ] 全选/反选快捷键
- [ ] 批量 Tauri Command 调用（如需要新增 batch_stage_files）
