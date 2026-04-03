# Feature: feat-markdown-split-preview Markdown 分栏预览

## Basic Information
- **ID**: feat-markdown-split-preview
- **Name**: Markdown 分栏预览（左代码右渲染）
- **Priority**: 55
- **Size**: M
- **Dependencies**: feat-file-type-router
- **Parent**: feat-file-type-display
- **Children**: null
- **Created**: 2026-04-03

## Description
当打开 Markdown (.md/.mdx) 文件时，编辑区分为左右两栏：左侧使用 Monaco 编辑 Markdown 源码，右侧使用 react-markdown 实时渲染预览。两栏支持拖拽调整宽度比例，滚动联动。

## User Value Points
1. **实时 Markdown 预览** — 边写边看渲染效果，无需切换视图
2. **分栏拖拽交互** — 自由调整代码/预览区域宽度

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 需要在 activeFile 渲染区增加分栏逻辑
- `neuro-syntax-ide/src/types.ts:OpenFileState` — 可能需要扩展预览相关字段
- `package.json` — react-markdown 已安装 (v10.x)

### Related Documents

### Related Features
- feat-file-type-router — 路由系统将 .md 文件分发到此渲染器

## Technical Solution

### Architecture
Created `MarkdownSplitView` component that wraps a split-pane layout:
- **Left panel**: Monaco editor (markdown mode, word-wrap on, minimap off)
- **Right panel**: `MarkdownRenderer` (react-markdown + remark-gfm for GFM tables/strikethrough)
- **Divider**: Custom draggable resizer with mouse events, ratio clamped to 20%-80%

### Key Implementation Details
1. **Routing integration**: In `EditorView.tsx`, when `activeFile.rendererType === 'markdown'`, renders `MarkdownSplitView` instead of plain `<Editor>`. Other file types are unaffected.
2. **Content sync**: Monaco `onChange` calls `onContentChange` prop which updates `activeFile.content` via `handleEditorChange`, triggering a re-render of `MarkdownRenderer` on the right.
3. **Scroll sync**: Uses Monaco `onDidScrollChange` event to compute scroll ratio (scrollTop / maxScroll) and applies proportional scroll to the preview pane via `scrollTop`.
4. **Theme**: Reuses existing `MarkdownRenderer` component with design-system-aware CSS classes (text-on-surface, bg-surface-container-*, etc.) — works in both light and dark themes automatically.
5. **remark-gfm**: Added to `MarkdownRenderer` for GFM table support, benefitting both the split preview and existing task detail modal.

### Files Changed
- `neuro-syntax-ide/src/components/views/MarkdownSplitView.tsx` (NEW) — split pane component
- `neuro-syntax-ide/src/components/views/EditorView.tsx` (MODIFIED) — conditional markdown rendering
- `neuro-syntax-ide/src/components/common/MarkdownRenderer.tsx` (MODIFIED) — added remark-gfm
- `neuro-syntax-ide/package.json` (MODIFIED) — added remark-gfm dependency

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望编辑 Markdown 文件时能同时看到源码和渲染效果，以提升文档编写效率。

### Scenarios (Given/When/Then)
#### Scenario 1: 打开 Markdown 文件
- Given 编辑器已打开
- When 用户打开一个 `.md` 文件
- Then 编辑区分为左右两栏
- And 左栏显示 Monaco 编辑器（Markdown 源码）
- And 右栏显示渲染后的富文本预览

#### Scenario 2: 实时同步预览
- Given 已打开 Markdown 分栏视图
- When 用户在左栏编辑内容
- Then 右栏实时更新渲染结果

#### Scenario 3: 分栏拖拽调整
- Given 已打开 Markdown 分栏视图
- When 用户拖拽中间分隔条
- Then 左右两栏宽度比例跟随调整

#### Scenario 4: 滚动联动
- Given 已打开 Markdown 分栏视图
- When 用户在左栏滚动
- Then 右栏预览同步滚动到对应位置

#### Scenario 5: 非 Markdown 文件不受影响
- Given 用户打开一个 `.ts` 文件
- Then 编辑区正常显示 Monaco 编辑器（无分栏）

### UI/Interaction Checkpoints
- 分栏分隔条有明确的视觉指示
- Markdown 预览样式与项目设计系统一致
- 支持标题、链接、代码块、列表、图片、表格等常见 Markdown 元素
- 预览区代码块使用等宽字体 + 语法高亮

### General Checklist
- [x] 使用 react-markdown 渲染（项目已有依赖）
- [x] 预览样式与深色/浅色主题同步
- [x] 大文件 Markdown 预览不卡顿

## Merge Record
- **Completed**: 2026-04-04
- **Merged Branch**: feature/feat-markdown-split-preview
- **Merge Commit**: a7ec88a
- **Archive Tag**: feat-markdown-split-preview-20260404
- **Conflicts**: none
- **Verification**: 5/5 Gherkin scenarios passed (code analysis)
- **Stats**: 1 commit, 5 files changed, ~30min duration
