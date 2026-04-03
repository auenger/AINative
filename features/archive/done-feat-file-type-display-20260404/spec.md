# Feature: feat-file-type-display 文件类型差异化展示

## Basic Information

* **ID**: feat-file-type-display

* **Name**: 文件类型差异化展示系统

* **Priority**: 60

* **Size**: L

* **Dependencies**: feat-editor-monaco (completed)

* **Parent**: null

* **Children**: feat-file-type-router, feat-markdown-split-preview, feat-image-config-preview

* **Created**: 2026-04-03

## Description

编辑器文件编辑框根据文件类型进行差异化展示。不同类型的文件（代码、Markdown、图片、配置）拥有各自优化的渲染方式和视觉风格。代码文件按语言（JS/TS/Vue/Java/Rust 等）定制编辑器风格；Markdown 提供分栏预览；图片和配置文件提供专用预览视图。

## User Value Points

1. **代码语言风格差异化** — JS/TS/Vue/Java/Rust 等代码文件各有不同的编辑器配置和视觉风格

2. **Markdown 分栏预览** — MD/MDX 文件左侧编辑 + 右侧实时渲染预览

3. **图片可视化预览** — PNG/JPG/SVG/GIF 等图片文件直接显示图片

4. **配置文件结构化视图** — JSON/YAML/TOML 文件提供树形折叠结构展示

## Context Analysis

### Reference Code

* `neuro-syntax-ide/src/components/views/EditorView.tsx` — 当前编辑器主组件，所有文件统一使用 Monaco Editor

* `neuro-syntax-ide/src/types.ts` — OpenFileState 类型定义

* `neuro-syntax-ide/src/lib/monaco-theme.ts` — Monaco 主题定义

### Related Documents

* project-context.md — Phase 3 编辑器相关规划

### Related Features

* feat-editor-monaco (completed) — Monaco 编辑器基础集成

* feat-editor-theme-perf (completed) — 编辑器渲染优化与深色风格适配

* feat-dark-theme-polish (completed) — 深色主题边框配色优化

## Technical Solution

## Acceptance Criteria (Gherkin)

### User Story

作为开发者，我希望不同类型的文件在编辑器中有不同的展示方式，以便我更高效地阅读和编辑各类文件。

### Scenarios (Given/When/Then)

#### Scenario 1: 文件类型自动识别

* Given 编辑器已打开

* When 用户点击文件树中的任意文件

* Then 系统根据文件扩展名自动选择对应的渲染器展示

#### Scenario 2: 代码文件风格差异

* Given 打开一个 .ts 文件

* Then 编辑器使用 TypeScript 语法高亮和对应的语言风格预设

* When 打开一个 .vue 文件

* Then 编辑器切换为 Vue 文件的风格预设（可能包含 template/script/style 区域标记）

#### Scenario 3: Markdown 分栏预览

* Given 打开一个 .md 文件

* Then 编辑区分为左右两栏，左侧为 Markdown 源码编辑，右侧为实时渲染预览

#### Scenario 4: 图片文件预览

* Given 打开一个 .png 文件

* Then 编辑区显示图片预览，而非二进制文本

### UI/Interaction Checkpoints

* 文件类型切换时无闪烁

* 分栏预览支持拖拽调整宽度

* 代码风格预设可扩展（新增语言只需添加配置）

### General Checklist

* [ ] 不修改原型设计系统基础颜色
* [ ] 复用 react-markdown (已安装)
* [ ] 保持 cn() 样式合并模式
* [ ] 类型定义集中在 types.ts

⠀