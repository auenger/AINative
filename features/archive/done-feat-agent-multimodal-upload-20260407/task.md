# Tasks: feat-agent-multimodal-upload
## Task Breakdown
### 1. Tauri 后端 — PMFile 文件管理 Command
- [x] `pmfile_upload` Command: 接收文件路径列表，复制到 `{workspace}/PMFile/`，处理冲突重命名
- [x] `pmfile_upload_bytes` Command: 接收文件字节流，写入 PMFile 目录（用于拖拽上传）
- [x] `pmfile_list` Command: 返回 PMFile 目录下所有文件的元信息（名称、大小、类型、修改时间）
- [x] `pmfile_delete` Command: 删除指定文件
- [x] `pmfile_rename` Command: 重命名指定文件
- [x] MIME 类型白名单校验逻辑

### 2. 前端 Hook — usePMFiles
- [x] `usePMFiles(workspacePath)` Hook: 封装 PMFile 文件的 CRUD 操作
- [x] 文件上传状态管理（uploading / uploaded / error）
- [x] 文件列表实时刷新

- [x] 文件类型校验（MIME + 扩展名白名单 + 大小限制）

### 3. UI — Agent 聊天面板文件上传区
- [x] 聊天输入区添加附件按钮（Paperclip icon）
- [x] 拖拽区域高亮反馈（dragover 状态）
- [x] 上传文件列表展示（输入区上方）
- [x] 文件类型图标映射（image/audio/pdf/document/markdown 等）
- [x] 上传进度指示
- [x] 文件删除确认交互

### 4. 集成与测试
- [x] PM Agent 和 REQ Agent 标签页均支持文件上传
- [x] 文件类型校验（不支持的格式提示）
- [ ] 大文件边界测试（需 Tauri 运行时环境）

## Progress Log
| Date       | Progress                                                               | Notes                                                         |
|------------|-------------------------------------------------------------------------|--------------------------------------------------------------|
| 2026-04-07   Task 1: Tauri 后端 PMFile Command                                             | 新增 pmfile_upload/upload_bytes/list/delete/rename Commands |
| 2026-04-07   Task 2: usePMFiles Hook                                                    | 新增 usePMFiles.ts — CRUD + 上传状态 + MIME 白名单 |
| 2026-04-07   Task 3: FileUploadArea 组件                                              | 新增 FileUploadArea.tsx — 拖拽 + 文件列表 + 类型图标 + 进度条 |
| 2026-04-07   Task 4: 集成到 ProjectView                                              | PM/REQ Agent 附件按钮 + 文件上传区域 |
| 2026-04-07   Types: PMFile 类型定义                                                  | 新增 PMFileEntry / PMFileUploading 类型                           |
