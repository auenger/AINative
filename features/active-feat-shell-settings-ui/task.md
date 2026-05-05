# Tasks: feat-shell-settings-ui
## Task Breakdown
### 1. Settings Schema 扩展
- [x] 在 Settings YAML 中添加 `terminal.default_shell` 字段
- [x] Rust 侧 `Settings` 结构体添加 terminal 字段
### 2. Settings UI — Shell 选择区
- [x] Settings 页面新增 "Terminal" 配置区域
- [x] 调用 `detect_shells` 获取 Shell 列表
- [x] 渲染 Shell 下拉选择组件（显示名称 + 路径）
- [x] 选中项保存到 Settings YAML
### 3. 终端创建逻辑改造
- [x] `XTerminal.tsx` 读取 Settings 中的 `default_shell`
- [x] `shellForKind('bash')` 使用用户选择的 Shell
- [x] Shell 不可用时回退到系统默认 + 错误提示
### 4. 终端 Tab 右键菜单（可选）
- [ ] 右键菜单增加 "Change Shell" 选项
- [ ] 弹出 Shell 选择子菜单
## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-05 | Implementation complete | Tasks 1-3 done, Task 4 (optional) deferred |
| 2026-04-30 | Feature created | 子 Feature 2/3 |
