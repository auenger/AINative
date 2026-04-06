# Feature: feat-load-project-context

## Basic Information
- **ID**: feat-load-project-context
- **Name**: Project Context 真实文件加载
- **Priority**: 60
- **Size**: S
- **Dependencies**: None
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-05

## Description

Project Tab 右侧的 PROJECT CONTEXT 区域当前使用硬编码的假数据（`useState` 中的静态字符串）。本 feature 将其改为通过 Tauri IPC `read_file` 命令读取项目根目录下的 `project-context.md` 文件，渲染真实的项目上下文内容。

## User Value Points

1. **真实项目上下文展示** — 用户在 Project Tab 可以看到项目实际的 `project-context.md` 内容，而非静态占位文本

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` 第 342-363 行：当前硬编码的 `projectContext` state
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` 第 1188-1206 行：PROJECT CONTEXT 渲染区域
- `neuro-syntax-ide/src-tauri/src/lib.rs` 第 5075 行：已有 `read_file` Tauri command

### Related Documents
- `project-context.md` — 要加载的目标文件

### Related Features
- feat-tauri-v2-init (Tauri IPC 基础设施)
- feat-workspace-loader (工作区路径获取)

## Technical Solution

1. 将 `useState` 硬编码字符串替换为 `useState<string | null>(null)` + `useEffect` 加载逻辑
2. 在 workspace 路径变化时，拼接 `${workspacePath}/project-context.md` 路径，调用 `invoke('read_file', { path })` 加载内容
3. 添加 loading 状态（骨架屏/shimmer）和 error 处理（文件不存在时显示友好提示）
4. 添加刷新按钮，允许用户手动重新加载
5. 文件不存在时提供 "Init Project" 功能引导

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望在 Project Tab 的 PROJECT CONTEXT 区域看到项目实际的 `project-context.md` 内容，而不是硬编码的占位数据。

### Scenarios (Given/When/Then)

**Scenario 1: 加载成功**
```gherkin
Given 用户已打开一个包含 project-context.md 的项目工作区
When 切换到 Project Tab
Then PROJECT CONTEXT 区域显示 project-context.md 的真实 Markdown 渲染内容
```

**Scenario 2: 文件不存在**
```gherkin
Given 用户已打开一个不包含 project-context.md 的项目工作区
When 切换到 Project Tab
Then PROJECT CONTEXT 区域显示友好的空状态提示，并引导用户初始化
```

**Scenario 3: 手动刷新**
```gherkin
Given PROJECT CONTEXT 已加载显示
When 用户点击刷新按钮
Then 系统重新读取文件并更新显示内容
```

### UI/Interaction Checkpoints
- 加载中：显示 shimmer 骨架动画
- 加载成功：Markdown 渲染（复用现有 ReactMarkdown 组件）
- 文件不存在：显示空状态 + "Init Project" 按钮
- 错误：显示错误信息提示

### General Checklist
- [x] 复用已有 `read_file` Tauri command，不新增后端代码
- [x] 复用已有设计系统（shimmer 动画、glass-panel 等）
- [x] 前端变更仅限 `ProjectView.tsx`

## Merge Record
- **Completed**: 2026-04-05
- **Branch**: feature/feat-load-project-context
- **Merge Commit**: 3ea4b5d
- **Archive Tag**: feat-load-project-context-20260405
- **Conflicts**: none
- **Verification**: passed (3/3 Gherkin scenarios)
- **Stats**: 1 commit, 1 file changed, 121 insertions, 27 deletions
