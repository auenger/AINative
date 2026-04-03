# Feature: feat-dock-icon App Dock 图标替换为 Logo

## Basic Information
- **ID**: feat-dock-icon
- **Name**: App Dock 图标替换为 Logo
- **Priority**: 70
- **Size**: S
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-03

## Description
dev 启动 App 时，macOS Dock 里显示的还是 Tauri 默认图标，需要将 `src-tauri/icons/` 下的标准图标文件（32x32.png、128x128.png、128x128@2x.png、icon.icns、icon.ico）替换为项目 Logo 导出的版本。

项目已有 logo 文件：logo128.png、logo256.png、logo512.png、logo.png，但 bundle icon 配置仍指向未替换的默认图标。

## User Value Points
1. **品牌一致性** — Dock 图标与应用内 Logo 统一，用户一眼识别

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/tauri.conf.json` → `bundle.icon` 数组
- `neuro-syntax-ide/src-tauri/icons/` → 当前图标 + logo 文件
- 历史完成: `feat-logo-update`（全局 Logo 更新，但未覆盖 bundle icon）

### Related Documents
- Tauri V2 Bundle Icon 文档

### Related Features
- feat-logo-update (已完成，仅更新了应用内 Logo)

## Technical Solution
使用 `sips`（macOS 内置）从 `logo.png`（1458x1458 高清源）缩放生成所有尺寸 PNG：
- 32x32.png: `sips -z 32 32 logo.png`
- 128x128.png: `sips -z 128 128 logo.png`
- 128x128@2x.png: `sips -z 256 256 logo.png`

使用 `iconutil -c icns` 从 iconset 目录生成 macOS icon.icns（含 16/32/128/256/512/1024 全尺寸）。
使用 Node.js `to-ico` 包生成 Windows icon.ico（含 16/32/48/256 尺寸）。

tauri.conf.json 的 `bundle.icon` 路径无需修改（文件名保持不变）。

## Merge Record
- **Completed**: 2026-04-03
- **Merged Branch**: feature/feat-dock-icon
- **Merge Commit**: c6d9b2107701082341762fdf0d272c759abdcf10
- **Archive Tag**: feat-dock-icon-20260403
- **Conflicts**: None
- **Verification**: All 2/2 Gherkin scenarios passed
- **Stats**: 1 commit, 5 files changed (binary icon replacements)

## Acceptance Criteria (Gherkin)
### User Story
作为开发者/用户，我希望在 macOS Dock 中看到项目 Logo 而非 Tauri 默认图标，以便识别应用。

### Scenarios (Given/When/Then)

**Scenario 1: Dock 显示自定义 Logo**
- Given `src-tauri/icons/` 下的图标文件已替换为 Logo 导出版本
- When 运行 `tauri dev` 启动应用
- Then macOS Dock 中显示项目 Logo 图标

**Scenario 2: 多分辨率覆盖**
- Given 不同尺寸的图标文件都已替换（32、128、256、512、icns、ico）
- When 应用在任意平台构建
- Then 所有平台均使用项目 Logo 图标

### UI/Interaction Checkpoints
- N/A（纯资源替换）

### General Checklist
- [ ] 图标文件尺寸正确（32/128/256/512）
- [ ] icon.icns 包含完整图标集
- [ ] icon.ico 包含完整图标集
- [ ] tauri.conf.json icon 路径无需修改（文件名不变）
