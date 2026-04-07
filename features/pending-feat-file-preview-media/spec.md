# Feature: feat-file-preview-media 视频/音频预览

## Basic Information
- **ID**: feat-file-preview-media
- **Name**: 视频/音频预览
- **Priority**: 50
- **Size**: S
- **Dependencies**: feat-file-preview-pdf
- **Parent**: feat-file-preview-multi
- **Children**: none
- **Created**: 2026-04-07

## Description
在编辑器页面中内嵌播放视频和音频文件。支持 MP4/WebM/MP3/WAV/OGG/FLAC 等常见格式，使用 HTML5 `<video>` 和 `<audio>` 元素原生播放，配合自定义控制栏。

## User Value Points
1. 视频文件可在编辑器中直接播放，无需打开外部播放器
2. 音频文件可在编辑器中播放，保持工作流连续性

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/lib/file-type-router.ts` — 需新增 `media` 路由类型
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 需新增 media 渲染分支
- `neuro-syntax-ide/src/types.ts` — `FileRendererType` 需扩展 `'media'`
- `neuro-syntax-ide/src/components/views/ImagePreview.tsx` — 参考加载/错误状态模式
- Tauri 后端：需通过 `convert_file_src` 或 asset 协议将本地文件转为可播放 URL

### Related Features
- feat-file-preview-pdf (前置依赖)
- feat-file-preview-image-enhance (后续子功能)

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为用户，我希望在文件树中双击视频或音频文件时，编辑器区域直接播放该文件，这样我可以在 IDE 内预览媒体内容。

### Scenarios (Given/When/Then)

#### Scenario 1: 打开视频文件
```gherkin
Given 用户已打开工作区
And 文件树中存在 .mp4 文件
When 用户点击该 MP4 文件
Then 编辑器区域显示视频播放器
And 视频加载后可播放
And 自定义控制栏显示播放/暂停、进度条、音量、时间
```

#### Scenario 2: 打开音频文件
```gherkin
Given 文件树中存在 .mp3 文件
When 用户点击该 MP3 文件
Then 编辑器区域显示音频播放器
And 播放器显示音频可视化或封面占位
And 播放控制栏正常工作
```

#### Scenario 3: 不支持的媒体格式
```gherkin
Given 文件树中存在 .mkv 文件
When 用户点击该 MKV 文件
Then 编辑器显示 "This media format is not supported for in-editor playback" 提示
And 建议使用外部播放器打开
```

#### Scenario 4: 非 Tauri 环境提示
```gherkin
Given 应用运行在非 Tauri 环境
When 用户尝试打开媒体文件
Then 显示提示信息 "Media playback is only available in Tauri desktop mode."
```

### UI/Interaction Checkpoints
- 视频播放器：居中显示，自适应容器尺寸
- 音频播放器：显示文件名、波形占位图、播放控制
- 控制栏：播放/暂停、进度条、音量、当前时间/总时长
- 加载/错误状态与 ImagePreview 风格一致

### General Checklist
- [ ] `FileRendererType` 扩展 `'media'`
- [ ] `file-type-router.ts` 新增视频/音频扩展名 → `'media'`
- [ ] `EditorView.tsx` 新增 `rendererType === 'media'` 分支
- [ ] 新建 `MediaPreview.tsx` 组件
- [ ] 视频使用 `<video>` 元素 + Tauri asset 协议
- [ ] 音频使用 `<audio>` 元素 + 自定义 UI
