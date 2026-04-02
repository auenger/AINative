# Feature: feat-logo-update 全局 Logo 更新

## Basic Information
- **ID**: feat-logo-update
- **Name**: 全局 Logo 更新 — 替换所有旧图标为新 Logo
- **Priority**: 55
- **Size**: S
- **Dependencies**: none
- **Parent**: null
- **Children**: empty
- **Created**: 2026-04-02

## Description
使用 `neuro-syntax-ide/src-tauri/icons/` 目录下的新 logo PNG 文件（logo.png, logo128.png, logo256.png, logo512.png）替换项目中所有旧的图标文件和引用位置，确保 App 在桌面端打包、Web favicon、导航栏等所有场景显示统一的新 logo。

## User Value Points
1. **品牌统一**：所有 logo 显示位置（App 图标、favicon、导航栏）使用统一的品牌 logo，提升专业感

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/icons/` — 新 logo 源文件（logo.png 2048KB, logo128.png 17KB, logo256.png 63KB, logo512.png 258KB）
- `neuro-syntax-ide/src-tauri/tauri.conf.json` 第 33-39 行 — bundle.icon 配置，当前引用旧图标
- `neuro-syntax-ide/index.html` — 缺少 favicon 链接
- `neuro-syntax-ide/src/components/TopNav.tsx` 第 20 行 — 文字 "NEURO SYNTAX" logo

### Current Icon Files (to be replaced)
| 文件 | 当前大小 | 说明 |
|------|---------|------|
| `icons/32x32.png` | 254B | 旧默认 Tauri 图标 |
| `icons/128x128.png` | 725B | 旧默认 Tauri 图标 |
| `icons/128x128@2x.png` | 1378B | 旧默认 Tauri 图标 |
| `icons/icon.icns` | 3242B | 旧默认 Tauri 图标 |
| `icons/icon.ico` | 9910B | 旧默认 Tauri 图标 |

### New Logo Files (available)
| 文件 | 大小 | 说明 |
|------|------|------|
| `icons/logo.png` | 2048KB | 原始高分辨率 logo |
| `icons/logo128.png` | 17KB | 128x128 |
| `icons/logo256.png` | 63KB | 256x256 |
| `icons/logo512.png` | 258KB | 512x512 |

### Related Documents
- Tauri V2 icon requirements: PNG (32x32, 128x128, 128x128@2x), ICNS (macOS), ICO (Windows)

### Related Features
- feat-tauri-v2-init (completed) — 初始化了当前旧图标

## Technical Solution

### 改动范围

#### 1. 替换 Tauri 打包图标
- 用 `sips` (macOS) 或 ImageMagick 从 `logo.png` 生成所需尺寸：
  - `32x32.png` — 从 logo128.png 缩放
  - `128x128.png` — 直接使用 logo128.png 重命名
  - `128x128@2x.png` — 直接使用 logo256.png 重命名
  - `icon.icns` — 用 `iconutil` 从 logo512.png 生成
  - `icon.ico` — 用 `sips` 或工具从 logo512.png 生成

#### 2. 添加 HTML Favicon
- 将 logo128.png 复制到 `neuro-syntax-ide/public/` 作为 favicon
- 在 `index.html` 中添加 `<link rel="icon" type="image/png" sizes="128x128" href="/favicon.png">`

#### 3. TopNav Logo（已完成 — 不在本次 feature 范围）
- SideNav 左上角已添加 logo 图片，TopNav 文字保留

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望在所有场景（桌面 App 图标、浏览器 favicon、导航栏）看到统一的新 logo，以获得一致的品牌体验。

### Scenarios (Given/When/Then)

#### Scenario 1: Tauri App 图标更新
```gherkin
Given 新 logo 文件存在于 icons/ 目录
When 执行 Tauri 构建 (cargo tauri build)
Then 打包的 .app / .dmg / .exe 使用新 logo 作为应用图标
```

#### Scenario 2: HTML Favicon 显示
```gherkin
Given index.html 包含 favicon 链接
When 在浏览器中打开开发服务器
Then 浏览器标签页显示新 logo 作为 favicon
```

### UI/Interaction Checkpoints
- [ ] macOS Dock 中显示新 logo
- [ ] 浏览器标签页 favicon 正确

### General Checklist
- [ ] 旧图标文件已替换
- [ ] tauri.conf.json 配置正确
- [ ] 构建成功无报错
