# Feature: feat-file-type-router 文件类型路由 + 代码风格差异化

## Basic Information
- **ID**: feat-file-type-router
- **Name**: 文件类型路由 + 代码语言风格差异化
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-editor-monaco (completed)
- **Parent**: feat-file-type-display
- **Children**: null
- **Created**: 2026-04-03

## Description
建立文件类型识别与路由系统，根据文件扩展名将文件分发到对应的渲染器。同时为不同编程语言（JS/TS/Vue/Java/Rust/Python 等）提供差异化的编辑器风格预设（字体大小、minimap、换行模式、Tab 大小等）。

## User Value Points
1. **文件类型智能路由** — 打开文件时自动选择最佳渲染方式
2. **代码语言风格差异化** — 不同语言有不同的编辑器配置，提升编码体验

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 当前 `openFile()` 函数统一创建 OpenFileState
- `neuro-syntax-ide/src/components/views/EditorView.tsx:getLanguageFromPath()` — 语言映射函数
- `neuro-syntax-ide/src/components/views/EditorView.tsx:editorOptions` — 统一的 Monaco 配置
- `neuro-syntax-ide/src/types.ts:OpenFileState` — 需要扩展 rendererType 字段

### Related Documents

### Related Features
- feat-editor-monaco (completed)

## Technical Solution
- Added `FileRendererType` enum (`monaco` | `markdown` | `image` | `config-tree` | `text` | `unsupported`) in `types.ts`
- Created `lib/file-type-router.ts` with `getFileRendererType()` using Set-based extension lookup
- Created `lib/language-presets.ts` with 16 language-specific Monaco editor presets
- Extended `getLanguageFromPath()` with Vue, Svelte, Java, Kotlin, Go, C/C++, C#, Swift, Ruby, PHP, GraphQL
- Extended `getFileIcon()` with icons for Python, Java/Kotlin, Go, C/C++, Vue, Svelte, shell, SQL
- Dynamic `editorOptions` via `getEditorOptionsForLanguage()` merging base options with language preset
- `openFile()` populates `rendererType` for type-based routing

## Merge Record
- **Completed**: 2026-04-03
- **Merged Branch**: feature/feat-file-type-router
- **Merge Commit**: f556a96
- **Archive Tag**: feat-file-type-router-20260403
- **Conflicts**: none
- **Verification**: All 5 Gherkin scenarios PASS (code analysis)
- **Stats**: 4 files changed, 308 insertions, 2 deletions

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望打开不同类型的代码文件时，编辑器自动应用最适合该语言的配置和视觉风格。

### Scenarios (Given/When/Then)
#### Scenario 1: 文件类型路由
- Given 编辑器已打开
- When 用户打开 `.md` 文件
- Then 文件被路由到 Markdown 渲染器
- When 用户打开 `.png` 文件
- Then 文件被路由到图片预览器
- When 用户打开 `.ts` 文件
- Then 文件被路由到代码编辑器

#### Scenario 2: TypeScript 风格预设
- Given 打开 `.ts` 文件
- Then Monaco 使用 TypeScript 语法高亮
- And Tab 大小为 2，启用自动导入
- And 使用代码编辑器默认风格

#### Scenario 3: Rust 风格预设
- Given 打开 `.rs` 文件
- Then Monaco 使用 Rust 语法高亮
- And Tab 大小为 4，启用 minimap

#### Scenario 4: Python 风格预设
- Given 打开 `.py` 文件
- Then Monaco 使用 Python 语法高亮
- And Tab 大小为 4

#### Scenario 5: Vue 文件风格预设
- Given 打开 `.vue` 文件
- Then Monaco 识别 Vue 单文件组件
- And 使用 HTML 语法高亮（或 vue 语法）

### UI/Interaction Checkpoints
- Tab 栏显示文件类型图标（已有 getFileIcon）
- 不同语言的文件打开时编辑器配置平滑切换
- 状态栏显示当前文件类型

### General Checklist
- [ ] 路由系统可扩展，新增文件类型只需添加配置
- [ ] 语言风格预设集中管理
- [ ] 不影响现有 Monaco 编辑功能
