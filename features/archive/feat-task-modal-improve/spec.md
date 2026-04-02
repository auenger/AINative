# Feature: feat-task-modal-improve Task 详情弹窗改进（尺寸 + 描述渲染）

## Basic Information
- **ID**: feat-task-modal-improve
- **Name**: Task 详情弹窗改进（尺寸 + 描述渲染）
- **Priority**: 70
- **Size**: M
- **Dependencies**: feat-detail-modal-interaction (已完成)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-02

## Description
修复 Task 详情弹窗的 3 个问题：
1. 弹窗弹出时高度可能超出屏幕 — 需要限制默认最大高度
2. 只能调整高度不能调整宽度 — `max-w-2xl` 限制了宽度调整，需要放宽
3. Description 区域是纯文本渲染 — 需要支持 Markdown 渲染

## User Value Points
1. **弹窗尺寸合理** — 默认高度不超出屏幕视口，且支持宽度和高度双向调整
2. **描述 Markdown 渲染** — 弹窗中 Description 字段从纯文本 `<p>` 改为使用 MarkdownRenderer 组件渲染

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:564-580` — Modal 容器样式（`minHeight: 360`, `resize: 'both'`, `max-w-2xl`）
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:626-632` — Description 纯文本渲染区域
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:160-163` — 卡片列表中的 description 也用纯文本
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:716-747` — Tab 内容区已使用 MarkdownRenderer

### Related Documents
- project-context.md 组件映射

### Related Features
- feat-detail-modal-interaction (已完成) — 之前实现了拖拽 + resize
- feat-md-render-task-detail (已完成) — 之前实现了 spec/tasks/checklist 的 Markdown 渲染

## Technical Solution

### Changes Applied

1. **Modal max-height constraint** (TaskBoard.tsx:568-576)
   - Added `maxHeight: '85vh'` to the inline `style` object on the modal container
   - Combined with existing `overflow: 'hidden'` on the container and `overflow-y-auto` on the body (`p-8` div), content scrolls inside when it exceeds the viewport

2. **Width limit relaxed** (TaskBoard.tsx:579)
   - Changed `max-w-2xl` (672px) to `max-w-4xl` (896px) in the modal className
   - `resize: 'both'` already allows user to resize beyond this, but the new default cap is wider

3. **Description Markdown rendering** (TaskBoard.tsx:627-632)
   - Replaced `<p>` tag with `<MarkdownRenderer content={...} />` component
   - Passed `className="opacity-80"` to preserve the visual opacity from the original `<p>` styling
   - `MarkdownRenderer` was already imported (line 30) and used elsewhere in the same file

4. **Card list description unchanged** (TaskBoard.tsx:160-163)
   - The card list preview continues to use plain `<p>` with `line-clamp-2` for compact display

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望 Task 详情弹窗大小合理不超出屏幕、支持宽高调整、且描述区域能正确渲染 Markdown 内容。

### Scenarios (Given/When/Then)

#### Scenario 1: 弹窗默认高度不超出屏幕
```gherkin
Given 用户在看板中点击一个任务卡片
When 详情弹窗弹出
Then 弹窗高度不超过视口高度的 85%
And 弹窗内容可通过内部滚动查看完整内容
```

#### Scenario 2: 弹窗支持宽度和高度调整
```gherkin
Given 详情弹窗已打开
When 用户拖拽弹窗右下角 resize 手柄
Then 可以同时调整弹窗的宽度和高度
And 调整宽度可以超过默认的 672px (max-w-2xl)
```

#### Scenario 3: Description 支持 Markdown 渲染
```gherkin
Given 任务的 description 字段包含 Markdown 格式文本（如粗体、列表）
When 用户打开该任务的详情弹窗
Then Description 区域正确渲染 Markdown 格式（标题、列表、粗体等）
And 不显示原始 Markdown 语法符号
```

### UI/Interaction Checkpoints
- [x] Modal 容器添加 `max-h-[85vh]` 限制
- [x] 移除或放宽 `max-w-2xl` 限制，允许用户拖拽到更宽
- [x] Description 区域使用 MarkdownRenderer 组件替代 `<p>` 标签
- [x] 卡片列表中的 description 预览保持纯文本（line-clamp-2 截断）

### General Checklist
- [x] 不影响拖拽功能
- [x] 不影响 Tab 内容区的 Markdown 渲染
- [x] 响应式：小屏幕下弹窗仍然合理
