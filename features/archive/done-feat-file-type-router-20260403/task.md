# Tasks: feat-file-type-router

## Task Breakdown

### 1. 文件类型枚举与路由系统
- [x] 在 types.ts 中定义 `FileRendererType` 枚举 (`monaco` | `markdown` | `image` | `config-tree` | `text` | `unsupported`)
- [x] 扩展 `OpenFileState` 增加 `rendererType` 字段
- [x] 创建 `getFileRendererType(path: string): FileRendererType` 函数
- [x] 完善文件扩展名到渲染器类型的映射

### 2. 语言风格预设系统
- [x] 创建 `lib/language-presets.ts` 集中管理各语言 Monaco 配置
- [x] 定义 TypeScript/JavaScript 预设 (tabSize: 2, wordWrap: off)
- [x] 定义 Rust 预设 (tabSize: 4, minimap: on)
- [x] 定义 Python 预设 (tabSize: 4)
- [x] 定义 Vue/Svelte 预设
- [x] 定义 Java/Kotlin 预设 (tabSize: 4)
- [x] 定义 HTML/CSS 预设 (tabWrap: on)
- [x] 定义 Markdown 预设 (wordWrap: on)

### 3. EditorView 集成
- [x] 修改 `openFile()` 填充 `rendererType`
- [x] 替换统一的 `editorOptions` 为 `getEditorOptions(language)` 动态生成
- [x] 在渲染区根据 `rendererType` 分发到不同渲染组件

### 4. 扩展语言映射
- [x] 在 `getLanguageFromPath()` 中增加 Vue, Svelte, Java, Kotlin, Go, C/C++ 等

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature initialized |
| 2026-04-03 | Completed | All 4 tasks implemented. New files: file-type-router.ts, language-presets.ts. Modified: types.ts, EditorView.tsx. TypeScript compiles clean. |
