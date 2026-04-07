# Tasks: feat-file-preview-pdf
## Task Breakdown
### 1. Types & Router
- [x] 扩展 `FileRendererType` 增加 `'pdf'`
- [x] `file-type-router.ts` 添加 `pdf` 扩展名 → `'pdf'` 路由

### 2. PdfPreview 组件
- [x] 新建 `components/views/PdfPreview.tsx`
- [x] 通过 Tauri `read_file_base64` 加载 PDF 二进制
- [x] 实现页码导航（上一页/下一页 + 键盘 PageUp/PageDown）
- [x] 实现缩放控制（Cmd+=/Cmd+-/Cmd+0）
- [x] 加载/错误/空状态 UI

### 3. EditorView 集成
- [x] `EditorView.tsx` 新增 `rendererType === 'pdf'` 分支，渲染 `PdfPreview`

### 4. 文件图标
- [x] `EditorView.tsx` 的 `getFileIcon` 新增 PDF 图标映射

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks implemented | pdfjs-dist@4.10.38 installed; PdfPreview component with page nav, zoom, HiDPI canvas rendering |
