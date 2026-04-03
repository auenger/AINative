# Tasks: feat-dock-icon

## Task Breakdown

### 1. 图标文件替换
- [x] 将 logo128.png 复制覆盖为 128x128.png
- [x] 将 logo256.png 复制覆盖为 128x128@2x.png（256px 用于 retina）
- [x] 生成 32x32.png（从 logo 缩放）
- [x] 从 logo 生成 icon.icns（macOS 完整图标集）
- [x] 从 logo 生成 icon.ico（Windows 图标）

### 2. 验证
- [x] `tauri dev` 启动后 Dock 图标为 Logo
- [x] 图标清晰度正常（非模糊）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | All tasks completed | 从 logo.png 使用 sips 生成所有尺寸 PNG，iconutil 生成 icns，to-ico 生成 ico。tauri.conf.json 无需修改。 |
