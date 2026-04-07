# Feature: feat-file-preview-image-enhance 图片预览增强

## Basic Information
- **ID**: feat-file-preview-image-enhance
- **Name**: 图片预览增强
- **Priority**: 50
- **Size**: S
- **Dependencies**: feat-file-preview-media
- **Parent**: feat-file-preview-multi
- **Children**: none
- **Created**: 2026-04-07

## Description
增强现有 ImagePreview 组件，支持更多图片格式（HEIC/RAW/PSD 等），添加 EXIF 元数据面板，提供图片信息摘要。让图片预览更专业、信息更丰富。

## User Value Points
1. 支持更多图片格式预览（HEIC、TIFF、RAW 等），减少"无法预览"的情况
2. EXIF 元数据面板显示拍摄信息（相机、镜头、曝光参数等），方便摄影和设计工作
3. 图片信息面板显示尺寸、大小、格式、色彩空间等元数据

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/ImagePreview.tsx` — 现有图片预览组件，需增强
- `neuro-syntax-ide/src/lib/file-type-router.ts` — 可能需扩展图片格式列表
- Tauri 后端：需新增命令读取图片 EXIF 数据

### Related Features
- feat-file-preview-pdf (同级子功能)
- feat-file-preview-media (前置依赖)

## Technical Solution

### Implementation
- **Tauri backend**: `read_image_meta` command in `lib.rs` — reads up to 64KB of image file header, parses dimensions (PNG/BMP/GIF/WebP/JPEG/TIFF), EXIF data (JPEG APP1/TIFF IFD/WebP EXIF chunk), GPS coordinates
- **Frontend**: `MetadataPanel` sub-component in `ImagePreview.tsx` — collapsible sidebar showing general info + EXIF section (conditionally rendered)
- **Extended formats**: `file-type-router.ts` adds HEIC/HEIF/TIFF/RAW/CR2/NEF/ARW/DNG/PSD/JFIF; `getMimeType()` helper maps all extensions to proper MIME types
- **Keyboard shortcut**: Cmd+I toggles info panel; Info icon button in toolbar

## Merge Record
- **Completed**: 2026-04-07T16:01:00Z
- **Merged branch**: feature/feat-file-preview-image-enhance
- **Merge commit**: 219611b
- **Feature commit**: 2dbc0f6
- **Archive tag**: feat-file-preview-image-enhance-20260407
- **Conflicts**: none
- **Verification**: passed (4/4 Gherkin scenarios, TypeScript compilation clean)
- **Stats**: 1 commit, 3 files changed, +832/-41 lines

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在编辑器中查看图片时能看到详细的元数据信息（如拍摄参数、文件属性），并且支持更多图片格式，这样我可以直接在 IDE 内完成图片审查工作。

### Scenarios (Given/When/Then)

#### Scenario 1: 显示图片元数据面板
```gherkin
Given 编辑器已打开一张 JPG 图片
When 图片加载完成
Then 工具栏右侧显示图片尺寸信息
And 底部或侧边面板可展开显示详细元数据（文件大小、格式、色彩空间）
```

#### Scenario 2: EXIF 数据展示
```gherkin
Given 编辑器已打开一张包含 EXIF 数据的图片
When 用户点击信息按钮或按快捷键 Cmd+I
Then 显示 EXIF 信息面板
And 面板包含：相机型号、镜头、光圈、快门速度、ISO、拍摄时间
```

#### Scenario 3: 无 EXIF 数据的图片
```gherkin
Given 编辑器已打开一张不含 EXIF 数据的 PNG 图片
When 用户查看元数据面板
Then 面板显示基本文件信息（尺寸、大小、格式）
And 不显示拍摄参数部分
```

#### Scenario 4: HEIC 格式支持
```gherkin
Given 文件树中存在 .heic 文件
When 用户点击该文件
Then 编辑器显示图片预览
And 图片正常渲染（通过 Tauri 后端转换为可显示格式）
```

### UI/Interaction Checkpoints
- 元数据面板：可折叠的侧边面板或底部面板
- EXIF 信息：分组展示（相机信息 / 拍摄参数 / GPS / 文件属性）
- 信息按钮：工具栏中新增 info 图标按钮
- 与现有缩放工具栏自然融合

### General Checklist
- [ ] 增强 `ImagePreview.tsx` 元数据显示能力
- [ ] 新增可折叠的元数据/EXIF 信息面板
- [ ] Tauri 后端新增 `read_image_meta` 命令
- [ ] 文件格式扩展（如 HEIC 通过后端转换）
