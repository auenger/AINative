# Feature: feat-agent-multimodal-upload Agent 多模态文件上传与管理

## Basic Information
- **ID**: feat-agent-multimodal-upload
- **Name**: Agent 多模态文件上传与管理
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: feat-agent-multimodal
- **Children**: []
- **Created**: 2026-04-06T24:00:00Z

## Description
为 PM Agent 和 REQ Agent 添加多文件上传能力。用户可以拖拽或选择多个文件（docx、pdf、png/jpg 图片、md、wav/mp3 音频等）上传到当前工作空间的 `{workspace}/PMFile/` 目录中。上传后的文件在 Agent 聊天面板中以文件列表形式展示，支持预览、删除、重命名操作。

## User Value Points
1. **多文件拖拽上传** — 用户可以通过拖拽或点击选择多个文件，统一上传到工作空间 PMFile 目录
2. **文件类型识别与预览** — 根据文件类型显示不同图标和预览（图片缩略图、文档图标、音频波形等）
3. **文件管理操作** — 对已上传文件进行查看、删除、重命名操作

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM Agent / REQ Agent 聊天面板
- `neuro-syntax-ide/src/lib/useAgentStream.ts` — Agent 流式通信 Hook
- `neuro-syntax-ide/src/lib/file-type-router.ts` — 文件类型路由（可扩展）
- `src-tauri/src/fs_commands.rs` — 文件系统 Command（read_file, write_file）
### Related Documents
- CLAUDE.md — 技术栈定义
### Related Features
- feat-load-project-context — 项目上下文加载
- feat-project-md-explorer — MD 文件浏览器

## Technical Solution
- **Rust Backend**: 5 Tauri commands (`pmfile_upload`, `pmfile_upload_bytes`, `pmfile_list`, `pmfile_delete`, `pmfile_rename`) in `lib.rs`
- **Frontend Hook**: `usePMFiles` Hook with MIME whitelist + extension fallback + 50MB limit
- **UI Component**: `FileUploadArea` with drag-and-drop, file list, type icons, progress bars, confirm-delete
- **Integration**: Both PM Agent and REQ Agent chat panels in `ProjectView.tsx` with Paperclip attach button
- **Types**: `PMFileEntry`, `PMFileUploadStatus`, `PMFileUploading` in `types.ts`
- **Security**: Path traversal protection in delete/rename, dual validation (frontend + backend)

## Acceptance Criteria (Gherkin)
### User Story
作为项目管理者，我希望能在 PM Agent / REQ Agent 聊天面板中上传多个参考文件（文档、图片、音频），以便 Agent 基于这些文件进行需求分析和上下文构建。

### Scenarios (Given/When/Then)

#### Scenario 1: 拖拽上传多个文件
```gherkin
Given 用户已打开项目页面并选中 PM Agent 或 REQ Agent 标签页
When 用户拖拽 3 个文件（1.docx, 2.pdf, 3.png）到 Agent 聊天面板
Then 文件应被复制到 {workspace}/PMFile/ 目录
And 聊天面板中应显示上传成功的文件列表（含文件名、类型图标、大小）
```

#### Scenario 2: 点击选择上传
```gherkin
Given 用户已打开项目页面
When 用户点击聊天输入区的附件按钮并选择多个文件
Then 文件应被保存到 {workspace}/PMFile/ 目录
And 文件列表应实时更新显示新上传的文件
```

#### Scenario 3: 不支持的文件类型提示
```gherkin
Given 用户拖拽一个 .exe 文件到聊天面板
When 系统检测到不支持该文件类型
Then 应显示错误提示 "不支持该文件类型" 且不执行上传
```

#### Scenario 4: 删除已上传文件
```gherkin
Given PMFile 目录中已有 2 个文件
When 用户在文件列表中点击某个文件的删除按钮并确认
Then 该文件应从 PMFile 目录和文件列表中移除
```

### UI/Interaction Checkpoints
- 聊天输入区增加 📎 附件按钮（或拖拽区域）
- 上传文件列表显示在聊天输入区上方或侧边
- 每个文件项显示：类型图标 + 文件名 + 大小 + 操作按钮
- 上传进度条（大文件场景）

### General Checklist
- [ ] 支持 MIME 类型白名单过滤
- [ ] 大文件上传错误处理（>50MB 提示）
- [ ] 文件名冲突处理（自动重命名）
- [ ] PMFile 目录自动创建
