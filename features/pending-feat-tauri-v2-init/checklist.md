# Checklist: feat-tauri-v2-init

## Completion Checklist

### Development
- [ ] 所有 task.md 中的任务项完成
- [ ] `src-tauri/` 目录结构正确且文件完整
- [ ] TopNav 改造完成 (拖拽区域 + 窗口控制按钮)

### Code Quality
- [ ] Cargo.toml 依赖版本正确 (tauri 2.x)
- [ ] tauri.conf.json 配置合理 (窗口尺寸、devUrl、frontendDist)
- [ ] 前端代码风格与原型一致 (TypeScript, Tailwind)
- [ ] 无硬编码 API Keys

### Testing
- [ ] `cargo tauri dev` 启动无报错
- [ ] `cargo tauri build` 构建成功
- [ ] 5 个视图切换正常
- [ ] 窗口拖拽移动正常
- [ ] 窗口控制按钮功能正常 (最小化/最大化/关闭)
- [ ] HMR 热更新正常工作
- [ ] 中英文切换正常

### Documentation
- [ ] spec.md Technical Solution 已填写
- [ ] task.md Progress Log 已更新
