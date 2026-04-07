# Tasks: feat-file-preview-pdf
## Task Breakdown
### 1. Types & Router
- [ ] 扩展 `FileRendererType` 增加 `'pdf'`
- [ ] `file-type-router.ts` 添加 `pdf` 扩展名 → `'pdf'` 路由

### 2. PdfPreview 组件
- [ ] 新建 `components/views/PdfPreview.tsx`
- [ ] 通过 Tauri `read_file_base64` 加载 PDF 二进制
- [ ] 实现页码导航（上一页/下一页 + 键盘 PageUp/PageDown）
- [ ] 实现缩放控制（Cmd+=/Cmd+-/Cmd+0 + 鼠标滚轮）
- [ ] 加载/错误/空状态 UI

### 3. EditorView 集成
- [ ] `EditorView.tsx` 新增 `rendererType === 'pdf'` 分支，渲染 `PdfPreview`

### 4. 文件图标
- [ ] `EditorView.tsx` 的 `getFileIcon` 新增 PDF 图标映射

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
