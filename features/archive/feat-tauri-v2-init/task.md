# Tasks: feat-tauri-v2-init

## Task Breakdown

### 1. Tauri V2 工程脚手架
- [ ] 在 `neuro-syntax-ide/` 下运行 `npm create tauri-app@latest` 或手动创建 `src-tauri/` 目录
- [ ] 配置 `src-tauri/Cargo.toml` (tauri 2.x, serde, serde_json)
- [ ] 编写 `src-tauri/src/main.rs` 和 `src-tauri/src/lib.rs` 基础入口
- [ ] 配置 `src-tauri/tauri.conf.json` (identifier, window size 1400x900, devUrl, frontendDist)
- [ ] 配置 `src-tauri/capabilities/default.json` 权限声明
- [ ] 准备应用图标 `src-tauri/icons/`

### 2. 前端依赖与 Vite 适配
- [ ] 安装 `@tauri-apps/api` v2 和 `@tauri-apps/plugin-opener` v2
- [ ] 安装 `@tauri-apps/cli` v2 作为 devDependency
- [ ] 在 `package.json` 中添加 `"tauri": "tauri"` script
- [ ] 确认 `vite.config.ts` dev server 配置与 Tauri `devUrl` 一致 (port 3000)

### 3. 无边框窗口与 TopNav 改造
- [ ] `tauri.conf.json` 设置 `"decorations": false`
- [ ] TopNav 添加 `data-tauri-drag-region` 拖拽区域属性
- [ ] TopNav 右侧添加窗口控制按钮 (最小化/最大化/关闭)
- [ ] 使用 `@tauri-apps/api/window` 的 `getCurrent()` 实现窗口操作
- [ ] 窗口控制按钮样式: 悬停变色，与深色主题一致

### 4. 验证与调试
- [ ] `cargo tauri dev` 启动验证
- [ ] 全部 5 个视图切换测试
- [ ] 窗口拖拽移动测试
- [ ] 窗口控制按钮功能测试 (最小化/最大化/关闭)
- [ ] HMR 热更新验证
- [ ] `cargo tauri build` 构建验证

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，等待开发 |
