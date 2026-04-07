# Tasks: feat-file-preview-image-enhance
## Task Breakdown
### 1. Tauri 后端 — 图片元数据命令
- [x] 新增 `read_image_meta` Rust 命令，返回 EXIF + 基本信息
- [x] 处理 HEIC/RAW 等格式转换为可显示格式

### 2. ImagePreview 增强
- [x] 新增可折叠的元数据/EXIF 信息面板
- [x] 工具栏新增 info 图标按钮 (Cmd+I 切换)
- [x] 加载并显示图片元数据：尺寸、大小、格式、色彩空间
- [x] 加载并显示 EXIF 数据（如存在）：相机、镜头、光圈、快门、ISO、拍摄时间
- [x] 扩展支持的图片格式

### 3. 文件类型路由更新
- [x] `file-type-router.ts` 扩展 `IMAGE_EXTENSIONS` 添加新格式

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-07 | All tasks completed | Fixed syntax errors in auto-generated ImagePreview.tsx, committed implementation |
