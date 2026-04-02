# Tasks: feat-logo-update

## Task Breakdown

### 1. 图标文件替换
- [ ] 从 logo128.png 生成 32x32.png（缩放）
- [ ] 将 logo128.png 复制为 128x128.png
- [ ] 将 logo256.png 复制为 128x128@2x.png
- [ ] 从 logo512.png 生成 icon.icns（macOS iconset）
- [ ] 从 logo512.png 生成 icon.ico（Windows 图标）

### 2. Tauri 配置
- [ ] 确认 tauri.conf.json bundle.icon 引用正确

### 3. HTML Favicon
- [ ] 创建 public/ 目录（如不存在）
- [ ] 复制 logo128.png 到 public/favicon.png
- [ ] 在 index.html 添加 favicon link 标签
- [ ] 修正 index.html title 为 "Neuro Syntax IDE"

### 4. 验证
- [ ] 运行 `cargo tauri build` 确认构建成功
- [ ] 检查开发模式下 favicon 显示
- [ ] 检查 TopNav logo 显示

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-02 | Feature created | 等待开发 |
