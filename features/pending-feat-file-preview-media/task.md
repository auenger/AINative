# Tasks: feat-file-preview-media
## Task Breakdown
### 1. Types & Router
- [x] 扩展 `FileRendererType` 增加 `'media'`
- [x] `file-type-router.ts` 添加视频扩展名 (mp4, webm, mov, avi, mkv) → `'media'`
- [x] `file-type-router.ts` 添加音频扩展名 (mp3, wav, ogg, flac, aac, m4a) → `'media'`

### 2. MediaPreview 组件
- [x] 新建 `components/views/MediaPreview.tsx`
- [x] 通过 Tauri `convertFileSrc` 将本地文件路径转为 asset URL
- [x] 视频模式：`<video>` 元素 + 居中自适应
- [x] 音频模式：自定义 UI + `<audio>` 元素
- [x] 统一控制栏：播放/暂停、进度条、音量、时间显示
- [x] 加载/错误/不支持格式状态 UI

### 3. EditorView 集成
- [x] `EditorView.tsx` 新增 `rendererType === 'media'` 分支，渲染 `MediaPreview`

### 4. 文件图标
- [x] `EditorView.tsx` 的 `getFileIcon` 新增视频/音频图标映射

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks completed | MediaPreview with video/audio playback, custom controls, Tauri asset protocol, icon mappings |
