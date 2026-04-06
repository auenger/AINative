# Feature: feat-project-md-explorer Project MD Explorer（项目首页 Markdown 文件浏览器）

## Basic Information
- **ID**: feat-project-md-explorer
- **Name**: Project MD Explorer（项目首页 Markdown 文件浏览器）
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-load-project-context（已完成）
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06

## Description
强化项目首页右侧面板的 Markdown 渲染区域。新增 MD 文件列表侧栏（显示项目根目录所有 .md 文件），支持文件选择、编辑/预览模式切换，以及优化后的 Markdown 富渲染预览。

## User Value Points
1. **MD 文件列表导航** — 左侧显示项目根目录所有 .md 文件，点击选中加载内容
2. **编辑/预览模式切换** — 可在 Markdown 原文编辑和富渲染预览间一键切换
3. **优化 Markdown 渲染** — 预览模式使用已有的 MarkdownRenderer 组件进行高质量渲染（GFM 表格、代码高亮、任务列表等）

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 主组件，右侧面板当前仅简单 ReactMarkdown 渲染
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` — 已有的富渲染组件（remark-gfm + 自定义组件映射）
- `neuro-syntax-ide/src/components/views/MarkdownSplitView.tsx` — 已有的分栏预览组件（可参考编辑/预览切换模式）
- `src-tauri/src/lib.rs` — `read_file` Command 已可用
- `src-tauri/src/lib.rs` — 需新增 `list_md_files` Command（或复用 `read_file_tree` 过滤）

### Related Documents
- project-context.md — 当前加载的目标文件之一

### Related Features
- feat-load-project-context（已完成）— 当前仅加载 project-context.md
- feat-markdown-split-preview（已完成）— 编辑器视图中的 Markdown 分栏预览

## Technical Solution

### 架构变更
在 ProjectView 右侧面板内部，将当前的单一 Markdown 渲染区域改为三栏布局：

```
┌──────────────────────────────────────────┐
│  [MD Files List]  │  [Content Area]      │
│  (左侧 ~180px)    │  ┌────────────────┐  │
│                   │  │ Edit | Preview  │  │
│  project-ctx.md ● │  │ (切换按钮)      │  │
│  README.md        │  ├────────────────┤  │
│  CLAUDE.md        │  │                │  │
│  module_1.md      │  │  内容区域       │  │
│  ...              │  │  (编辑/预览)    │  │
│                   │  │                │  │
└──────────────────────────────────────────┘
```

### 新增 Tauri Command
- `list_md_files(path: String)` — 列出指定目录下所有 .md 文件（文件名 + 路径）
- 或复用现有 `read_file_tree` + 前端过滤 .md 文件

### 复用已有组件
- `MarkdownRenderer` — 预览模式渲染
- Monaco Editor / textarea — 编辑模式
- `cn()` 样式合并、设计系统颜色

### 文件保存
- 编辑后通过 `write_file` Command 保存
- 保存后自动刷新预览

## Acceptance Criteria (Gherkin)

### User Story
作为项目开发者，我希望在项目首页快速浏览和编辑项目中的 Markdown 文档，以便高效管理项目文档。

### Scenarios (Given/When/Then)

#### Scenario 1: 文件列表加载
```gherkin
Given 用户已打开工作区
When 项目首页右侧面板渲染
Then 显示项目根目录下所有 .md 文件列表
And 默认选中 project-context.md
And 加载并显示该文件内容
```

#### Scenario 2: 文件选择切换
```gherkin
Given 文件列表已加载
When 用户点击另一个 .md 文件
Then 该文件被选中（高亮显示）
And 内容区域加载并显示该文件内容
And 保持当前的编辑/预览模式状态
```

#### Scenario 3: 切换到预览模式
```gherkin
Given 当前处于编辑模式
When 用户点击 "Preview" 切换按钮
Then 内容区域切换为 MarkdownRenderer 富渲染预览
And 渲染包括 GFM 表格、代码块、任务列表等
```

#### Scenario 4: 切换到编辑模式
```gherkin
Given 当前处于预览模式
When 用户点击 "Edit" 切换按钮
Then 内容区域切换为文本编辑器
And 显示 Markdown 原文
And 可编辑内容
```

#### Scenario 5: 编辑并保存
```gherkin
Given 当前处于编辑模式且已修改内容
When 用户触发保存（Cmd+S 或保存按钮）
Then 通过 write_file Command 将内容写入文件
And 保存成功后显示成功提示
And 预览模式可查看最新内容
```

#### Scenario 6: 无 .md 文件的空状态
```gherkin
Given 用户已打开工作区
But 根目录下没有任何 .md 文件
Then 文件列表显示空状态提示
And 内容区域显示引导信息
```

### UI/Interaction Checkpoints
- 文件列表项 hover 效果 + 选中高亮
- 编辑/预览切换按钮带有图标和动画过渡
- 内容切换时有平滑过渡效果
- 保存状态指示器（已修改/已保存）

### General Checklist
- 复用 MarkdownRenderer 组件，不重复实现
- 使用 cn() 合并样式
- 类型定义遵循 types.ts 集中管理
- 不引入新依赖（react-markdown、remark-gfm 已有）
