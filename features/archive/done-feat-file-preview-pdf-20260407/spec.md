# Feature: feat-file-preview-pdf PDF 文件预览

## Basic Information
- **ID**: feat-file-preview-pdf
- **Name**: PDF 文件预览
- **Priority**: 50
- **Size**: S
- **Dependencies**: none
- **Parent**: feat-file-preview-multi
- **Children**: none
- **Created**: 2026-04-07

## Description
在编辑器页面中内嵌渲染 PDF 文件，支持翻页浏览、缩放控制。当用户在文件树中点击 .pdf 文件时，在编辑器区域展示 PDF 内容而非打开外部程序。

## User Value Points
1. PDF 文件可直接在编辑器内查看，无需切换到外部阅读器
2. 支持翻页和缩放操作，流畅浏览多页文档

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/lib/file-type-router.ts` — 文件类型路由，需新增 `pdf` 类型
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 编辑器主视图，需新增 pdf 渲染分支
- `neuro-syntax-ide/src/types.ts` — `FileRendererType` 需扩展 `'pdf'`
- `neuro-syntax-ide/src/components/views/ImagePreview.tsx` — 可参考其缩放/加载模式
- Tauri 后端需提供 `read_file_base64` 命令（已有）用于读取 PDF 二进制数据

### Related Documents
- Tauri V2 API docs — `invoke()` 调用模式

### Related Features
- feat-file-preview-media (后续子功能)
- feat-file-preview-image-enhance (后续子功能)

## Technical Solution
- Library: `pdfjs-dist@4.10.38` (Mozilla PDF.js) for rendering PDF pages to HTML Canvas
- Data loading: Tauri `read_file_base64` command reads PDF binary, decoded client-side to `Uint8Array` for pdfjs
- Rendering: Each page rendered to a `<canvas>` element with HiDPI (devicePixelRatio) support
- Zoom: Scale parameter on pdfjs viewport + CSS canvas sizing; keyboard shortcuts Cmd+=/Cmd+-/Cmd+0
- Page navigation: `getPage(n)` API; PageUp/PageDown keyboard shortcuts
- File type routing: `file-type-router.ts` maps `.pdf` extension to `'pdf'` renderer type
- EditorView: PDF treated as binary (skip text read), renders `PdfPreview` component

## Merge Record
- **Completed**: 2026-04-07T13:00:00Z
- **Merged Branch**: feature/feat-file-preview-pdf
- **Merge Commit**: 278137d
- **Archive Tag**: feat-file-preview-pdf-20260407
- **Conflicts**: none
- **Verification**: passed (4/4 Gherkin scenarios)
- **Duration**: ~30min
- **Commits**: 2
- **Files Changed**: 13 (767 insertions, 44 deletions)

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在文件树中点击 PDF 文件时，编辑器区域直接显示 PDF 内容，这样我无需离开 IDE 就能查看文档。

### Scenarios (Given/When/Then)

#### Scenario 1: 打开 PDF 文件
```gherkin
Given 用户已打开工作区
And 文件树中存在 .pdf 文件
When 用户点击该 PDF 文件
Then 编辑器区域显示 PDF 预览组件
And PDF 第一页内容可见
And 工具栏显示当前页码和总页数
```

#### Scenario 2: PDF 翻页
```gherkin
Given 编辑器已打开一个多页 PDF 文件
When 用户点击下一页按钮或按下键盘 PageDown
Then 编辑器显示下一页内容
And 页码指示器更新为 "2/N"
```

#### Scenario 3: PDF 缩放
```gherkin
Given 编辑器已打开 PDF 文件
When 用户使用 Cmd+= 放大或鼠标滚轮（按住 Cmd）
Then PDF 内容放大显示
And 缩放百分比在工具栏中更新
```

#### Scenario 4: 非 Tauri 环境提示
```gherkin
Given 应用运行在非 Tauri 环境（Web 开发模式）
When 用户尝试打开 PDF 文件
Then 显示提示信息 "PDF preview is only available in Tauri desktop mode."
```

### UI/Interaction Checkpoints
- PDF 预览组件替代 Monaco 编辑器显示在编辑器区域
- 顶部工具栏：页码导航（上一页/下一页）、页码显示、缩放控制（放大/缩小/重置）
- 加载状态：与 ImagePreview 一致的 loading spinner
- 错误状态：显示错误信息 + 文件名

### General Checklist
- [ ] `FileRendererType` 扩展 `'pdf'`
- [ ] `file-type-router.ts` 新增 PDF 扩展名路由
- [ ] `EditorView.tsx` 新增 `rendererType === 'pdf'` 分支
- [ ] 新建 `PdfPreview.tsx` 组件
- [ ] PDF 文件通过 Tauri `read_file_base64` 加载
- [ ] 支持翻页和缩放操作
