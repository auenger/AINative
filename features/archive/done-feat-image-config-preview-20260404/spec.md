# Feature: feat-image-config-preview 图片 & 配置文件预览

## Basic Information
- **ID**: feat-image-config-preview
- **Name**: 图片可视化预览 + 配置文件结构化视图
- **Priority**: 50
- **Size**: M
- **Dependencies**: feat-file-type-router
- **Parent**: feat-file-type-display
- **Children**: null
- **Created**: 2026-04-03

## Description
为图片文件（PNG/JPG/SVG/GIF/WebP）提供可视化预览，替代二进制文本展示。为 JSON/YAML/TOML 配置文件提供可选的结构化树形视图，支持节点折叠展开。

## User Value Points
1. **图片可视化预览** — 图片文件直接显示图片，支持缩放和尺寸信息
2. **配置文件结构化视图** — JSON/YAML/TOML 以树形结构展示，方便浏览

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 需要在渲染区增加图片和配置视图
- `neuro-syntax-ide/src/types.ts` — 需要扩展文件类型定义

### Related Documents

### Related Features
- feat-file-type-router — 路由系统将图片/配置文件分发到此渲染器

## Technical Solution
### Architecture
- `ImagePreview.tsx`: Handles all image types (PNG/JPG/GIF/WebP/BMP/ICO/AVIF/SVG). SVG files are read as text and sanitized (script tags, event handlers stripped) before rendering. Raster images are loaded via `read_file_base64` Tauri command and displayed as data URLs. Includes zoom controls (toolbar buttons + mouse wheel + keyboard shortcuts) and checkerboard background for transparency.
- `ConfigTreeView.tsx`: Parses JSON/YAML/TOML/INI content into a unified tree node structure. Supports tree view (collapsible nodes with type icons) and editor view (Monaco). Toggle between views via toolbar buttons. Expand All / Collapse All controls provided.
- `EditorView.tsx`: Extended to route `image` renderer type to `ImagePreview` and `config-tree` renderer type to `ConfigTreeView`.
- Tauri backend: Added `read_file_base64` command for reading binary files, with `base64` crate dependency.

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望打开图片文件时能看到图片预览，打开配置文件时能看到结构化视图，以便快速理解文件内容。

### Scenarios (Given/When/Then)
#### Scenario 1: 图片预览
- Given 编辑器已打开
- When 用户打开 `.png` 文件
- Then 编辑区显示图片预览（居中显示，自适应大小）
- And 显示图片尺寸信息

#### Scenario 2: SVG 预览
- Given 编辑器已打开
- When 用户打开 `.svg` 文件
- Then 编辑区显示 SVG 渲染结果

#### Scenario 3: 大图缩放
- Given 已打开图片预览
- When 图片尺寸大于编辑区域
- Then 图片缩放至适应编辑区大小
- And 支持滚轮缩放

#### Scenario 4: JSON 结构化视图
- Given 打开 `.json` 文件
- Then 编辑区显示 Monaco 编辑器 + 可切换到树形结构视图
- When 切换到树形视图
- Then JSON 数据以可折叠的树形结构展示

#### Scenario 5: YAML 结构化视图
- Given 打开 `.yaml` 文件
- Then 支持切换到树形结构视图展示 YAML 层级

### UI/Interaction Checkpoints
- 图片预览区背景使用棋盘格（表示透明度）
- 图片尺寸信息显示在底部状态栏
- 配置文件结构化视图支持点击节点高亮
- 编辑/结构化视图切换按钮在顶部工具栏

### General Checklist
- [ ] 图片加载失败时显示友好错误提示
- [ ] 配置文件树形视图深色/浅色主题适配
- [ ] SVG 预览考虑安全性（不执行脚本）
